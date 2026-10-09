import { servingReference, gramReference } from './portions.js';

export function setupFoodSearch({ form, preview, isBusy }) {
  const $ = selector => document.querySelector(selector);
  const name = form.elements.food_name, results = $('#food-results'), status = $('#search-status'), source = $('#food-source');
  const portionSelect = $('#food-portion'), gramsInput = form.elements.serving_grams;
  let selected = null, reference = null, timer, controller, generation = 0, enabled = true;
  const format = number => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(number);
  function cancel() { clearTimeout(timer); controller?.abort(); generation++; }
  function describeSelection() {
    source.replaceChildren(); source.hidden = !selected;
    $('#portion-fields').hidden = !selected;
    for (const option of form.elements.unit.options) option.disabled = Boolean(selected) && option.value === 'ml';
    gramsInput.required = Boolean(selected) && form.elements.unit.value === 'serving';
    gramsInput.disabled = !selected || form.elements.unit.value !== 'serving';
    if (!selected) return;
    source.append(document.createTextNode('USDA estimate. One serving means the portion you select or define below. '));
    const link = document.createElement('a'); link.textContent = 'View source'; link.href = selected.provider_url;
    link.target = '_blank'; link.rel = 'noopener noreferrer'; source.append(link);
  }
  function fillValues(next) {
    reference = next;
    form.elements.basis_quantity.value = next.basis_quantity;
    for (const [key, value] of Object.entries(next.basis)) form.elements[key].value = value ?? '';
    preview();
  }
  function updatePortion() {
    if (!selected) return;
    describeSelection();
    if (form.elements.unit.value === 'g') { fillValues(selected); return; }
    try { fillValues(servingReference(selected, gramsInput.value, form.elements.serving_label.value)); }
    catch {
      reference = null;
      form.elements.basis_quantity.value = '1';
      for (const key of Object.keys(selected.basis)) form.elements[key].value = '';
      preview();
    }
  }
  function setPortions(food, savedEntry = null) {
    portionSelect.replaceChildren();
    for (const portion of food.portions || []) {
      const option = document.createElement('option'); option.value = portion.id;
      option.textContent = `${portion.label} (${format(portion.grams)} g)`; portionSelect.append(option);
    }
    const custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = 'My serving size'; portionSelect.append(custom);
    if (savedEntry?.serving_grams) {
      portionSelect.value = 'custom'; gramsInput.value = savedEntry.serving_grams;
      form.elements.serving_label.value = savedEntry.serving_label || '1 serving';
    } else if (food.portions?.length) {
      portionSelect.value = food.portions[0].id; gramsInput.value = food.portions[0].grams;
      form.elements.serving_label.value = food.portions[0].label;
    } else {
      portionSelect.value = 'custom'; gramsInput.value = ''; form.elements.serving_label.value = '1 serving';
    }
  }
  async function choose(food) {
    if (isBusy()) return;
    cancel(); const version = generation;
    controller = new AbortController(); status.textContent = 'Loading serving sizes…'; results.replaceChildren();
    selected = reference = null;
    for (const key of Object.keys(food.basis)) form.elements[key].value = '';
    describeSelection(); preview();
    let resolved = food, detailsFailed = false;
    try {
      const response = await fetch(`/api/foods/usda/${encodeURIComponent(food.source_id)}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok || !data.food) throw Error('Portions unavailable');
      resolved = data.food;
    } catch (error) { if (error.name === 'AbortError') return; detailsFailed = true; }
    if (version !== generation || isBusy() || !$('#entry-dialog').open) return;
    selected = resolved;
    name.value = resolved.food_name; form.elements.unit.value = 'serving'; form.elements.quantity.value = '1';
    setPortions(resolved); updatePortion();
    status.textContent = resolved.portions?.length ? 'One serving is selected. Adjust the number eaten and review calories per serving.' : `${detailsFailed ? 'Serving details could not be loaded. ' : 'This food has no published serving size. '}Enter the grams in your serving, or choose grams as the unit. No serving weight is assumed.`;
    form.elements.quantity.focus();
  }
  async function search() {
    cancel(); const query = name.value.trim(); results.replaceChildren();
    if (query.length < 2 || query.length > 100) { status.textContent = 'Search using 2–100 characters, or enter nutrition manually.'; return; }
    if (!enabled || isBusy() || !$('#entry-dialog').open) return;
    const version = generation; controller = new AbortController(); status.textContent = 'Searching USDA…';
    try {
      const response = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
      const data = await response.json();
      if (version !== generation) return;
      if (!response.ok) throw Error(data.error || 'Food search unavailable. Enter nutrition manually.');
      if (!Array.isArray(data.foods)) throw Error('Food search returned an unexpected response. Enter nutrition manually.');
      status.textContent = data.foods.length ? `Choose the matching preparation to see serving sizes.${data.mode === 'demo' ? ' Demo lookup has a small free allowance.' : ''}` : 'No matching foods found. Try a more specific name or enter nutrition manually.';
      for (const food of data.foods) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'food-result secondary';
        const heading = document.createElement('strong'); heading.textContent = food.food_name;
        const detail = document.createElement('span'); detail.textContent = `USDA · ${food.data_type} · select to calculate per serving`;
        button.append(heading, detail); button.onclick = () => choose(food); results.append(button);
      }
    } catch (error) {
      if (version === generation && error.name !== 'AbortError') status.textContent = error.message === 'Failed to fetch' ? 'Could not connect to food search. You can still enter nutrition manually.' : error.message;
    }
  }
  portionSelect.onchange = () => {
    const portion = selected?.portions?.find(item => item.id === portionSelect.value);
    gramsInput.value = portion?.grams ?? '';
    form.elements.serving_label.value = portion?.label || '1 serving'; updatePortion();
  };
  gramsInput.oninput = () => { portionSelect.value = 'custom'; updatePortion(); };
  form.elements.serving_label.addEventListener('input', updatePortion);
  form.elements.unit.addEventListener('change', () => {
    if (selected) {
      const oldGrams = reference?.basis_unit === 'serving' ? reference.serving_grams : null;
      const amount = Number(form.elements.quantity.value);
      if (form.elements.unit.value === 'g' && oldGrams) form.elements.quantity.value = amount * oldGrams;
      else if (form.elements.unit.value === 'serving' && Number(gramsInput.value) > 0) form.elements.quantity.value = amount / Number(gramsInput.value);
      updatePortion();
    }
    preview();
  });
  name.addEventListener('input', () => {
    cancel();
    if (selected) for (const key of Object.keys(selected.basis)) form.elements[key].value = '';
    selected = reference = null; describeSelection(); results.replaceChildren(); preview();
    if (!enabled) return;
    if (name.value.trim().length < 2) { status.textContent = 'Type at least two characters to search USDA foods.'; return; }
    status.textContent = 'Waiting to search…'; timer = setTimeout(search, 800);
  });
  form.addEventListener('input', event => {
    if (selected && ['energy_kcal', 'protein_g', 'carbs_g', 'fat_g', 'basis_quantity'].includes(event.target.name)) {
      selected = reference = null; describeSelection(); status.textContent = 'Nutrition edited manually. Review the serving and its nutrition before saving.';
    }
  });
  name.addEventListener('keydown', event => { if (event.key === 'Enter' && enabled) { event.preventDefault(); search(); } });
  $('#food-search').onclick = () => { enabled = true; search(); };
  $('#food-manual').onclick = () => {
    if (isBusy()) return;
    cancel(); enabled = false; selected = reference = null; describeSelection(); results.replaceChildren();
    status.textContent = 'Manual entry. Enter nutrition per serving, or choose another unit and basis.';
  };
  return {
    reference: () => reference,
    cancel,
    reset: entry => {
      cancel(); enabled = !entry; selected = entry?.source === 'usda' ? gramReference(entry) : null; reference = selected ? entry : null;
      results.replaceChildren();
      if (selected) setPortions(selected, entry);
      describeSelection();
      status.textContent = entry ? 'Editing saved nutrition. Search foods to look up a replacement.' : 'Type a food to search USDA, or enter nutrition for one serving manually.';
    },
  };
}
