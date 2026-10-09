export function setupFoodSearch({ form, preview, isBusy }) {
  const name = form.elements.food_name;
  const results = document.querySelector('#food-results');
  const status = document.querySelector('#search-status');
  const source = document.querySelector('#food-source');
  let selected = null, timer, controller, generation = 0, enabled = true;
  const format = number => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number);

  function cancel() { clearTimeout(timer); controller?.abort(); generation++; }
  function describeSelection(food) {
    source.replaceChildren(); source.hidden = !food;
    for (const option of form.elements.unit.options) option.disabled = Boolean(food) && option.value !== 'g';
    if (!food) return;
    source.append(document.createTextNode('USDA estimate per 100 g. Choose the matching preparation; values vary between foods. '));
    const link = document.createElement('a');
    link.textContent = 'View source'; link.href = food.provider_url;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; source.append(link);
  }
  function choose(food) {
    if (isBusy()) return;
    cancel(); selected = food;
    const wasGrams = form.elements.unit.value === 'g';
    name.value = food.food_name;
    form.elements.unit.value = 'g';
    if (!wasGrams) form.elements.quantity.value = '100';
    form.elements.basis_quantity.value = '100';
    for (const [key, value] of Object.entries(food.basis)) form.elements[key].value = value ?? '';
    results.replaceChildren(); status.textContent = 'Food selected. Enter the amount eaten in grams and review the estimate.';
    describeSelection(food); preview(); form.elements.quantity.focus();
  }
  async function search() {
    cancel();
    const query = name.value.trim();
    results.replaceChildren();
    if (query.length < 2 || query.length > 100) { status.textContent = 'Search using 2–100 characters, or enter nutrition manually.'; return; }
    if (!enabled || isBusy() || !document.querySelector('#entry-dialog').open) return;
    const version = generation;
    controller = new AbortController();
    status.textContent = 'Searching USDA…';
    try {
      const response = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      const data = await response.json();
      if (version !== generation) return;
      if (!response.ok) throw Error(data.error || 'Food search unavailable. Enter nutrition manually.');
      if (!Array.isArray(data.foods)) throw Error('Food search returned an unexpected response. Enter nutrition manually.');
      status.textContent = data.foods.length ? `Choose the closest match, including raw or cooked preparation.${data.mode === 'demo' ? ' Demo search has a small free allowance.' : ''}` : 'No matching foods found. Try a more specific name or enter nutrition manually.';
      for (const food of data.foods) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'food-result secondary';
        const heading = document.createElement('strong'); heading.textContent = food.food_name;
        const detail = document.createElement('span');
        detail.textContent = `USDA · ${food.data_type} · ${food.basis.energy_kcal === null ? 'Calories not available' : format(food.basis.energy_kcal) + ' kcal'} per 100 g`;
        button.append(heading, detail); button.onclick = () => choose(food); results.append(button);
      }
    } catch (error) {
      if (version === generation && error.name !== 'AbortError') status.textContent = error.message === 'Failed to fetch' ? 'Could not connect to food search. You can still enter nutrition manually.' : error.message;
    }
  }
  name.addEventListener('input', () => {
    cancel();
    // A new name must not inherit nutrition from the previously selected food.
    if (selected) for (const key of Object.keys(selected.basis)) form.elements[key].value = '';
    selected = null; describeSelection(null); results.replaceChildren(); preview();
    if (!enabled) return;
    if (name.value.trim().length < 2) { status.textContent = 'Type at least two characters to search USDA foods.'; return; }
    status.textContent = 'Waiting to search…'; timer = setTimeout(search, 800);
  });
  form.addEventListener('input', event => {
    if (selected && ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g', 'basis_quantity', 'unit'].includes(event.target.name)) {
      selected = null; describeSelection(null);
      status.textContent = 'Nutrition edited manually. Review the values and their basis before saving.';
    }
  });
  name.addEventListener('keydown', event => {
    if (event.key === 'Enter' && enabled) { event.preventDefault(); search(); }
  });
  document.querySelector('#food-search').onclick = () => { enabled = true; search(); };
  document.querySelector('#food-manual').onclick = () => {
    if (isBusy()) return;
    cancel(); enabled = false; selected = null; describeSelection(null); results.replaceChildren();
    status.textContent = 'Manual entry. Review the nutrition basis and enter your own values. Search foods re-enables lookup.';
  };
  return {
    reference: () => selected,
    cancel,
    reset: entry => {
      cancel(); enabled = !entry; selected = entry?.source === 'usda' ? entry : null;
      results.replaceChildren(); describeSelection(selected);
      status.textContent = entry ? 'Editing saved nutrition. Search foods to look up a replacement.' : 'Type at least two characters to search USDA foods, or enter nutrition manually.';
    },
  };
}
