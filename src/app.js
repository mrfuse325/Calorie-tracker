import { nutrients, meals, localDate, makeEntry, numberValue, scale, totals } from './nutrition.js';
import { storage } from './storage.js';
import { setupFoodSearch } from './food-search.js';
import { setupGoalCalculator } from './goals-ui.js';
const $ = selector => document.querySelector(selector);
const entryForm = $('#entry-form');
const dateInput = $('#diary-date');
const names = { energy_kcal: 'Calories', protein_g: 'Protein', carbs_g: 'Carbs', fat_g: 'Fat' };
const units = { g: 'grams', ml: 'milliliters', serving: 'servings / pieces' };
let entries = [], goals = {}, editing = null, busy = false, ready = false, deleted = null;
const format = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function message(selector, text) {
  const node = $(selector);
  node.textContent = text;
  node.hidden = !text;
}
function notice(text) { $('#notice').replaceChildren(element('span', text)); }
function currentEntries() { return entries.filter(entry => entry.diary_date === dateInput.value); }
function render() {
  const day = currentEntries();
  const daily = totals(day);
  $('#summary').replaceChildren(...nutrients.map(key => {
    const data = daily[key], target = goals[key];
    const card = element('article', undefined, 'stat');
    card.append(element('h3', names[key]), element('strong', `${format(data.value)} ${key === 'energy_kcal' ? 'kcal' : 'g'}`));
    if (data.missing) card.append(element('p', `${data.missing} ${data.missing === 1 ? 'entry missing' : 'entries missing'} ${names[key].toLowerCase()} · recorded total only`));
    if (target !== null && target !== undefined) {
      card.append(element('p', `Target: ${format(target)} ${key === 'energy_kcal' ? 'kcal' : 'g'}`));
      if (!data.missing) {
        const difference = target - data.value;
        card.append(element('p', `${format(Math.abs(difference))} ${difference < 0 ? 'over target' : 'remaining'}`));
        if (target > 0) {
          const progress = element('progress');
          progress.max = target; progress.value = Math.min(target, data.value);
          progress.setAttribute('aria-label', `${names[key]} progress toward target`);
          card.append(progress);
        }
      } else card.append(element('p', 'Remaining amount unavailable until missing values are entered.'));
    } else card.append(element('p', 'No target set'));
    return card;
  }));
  $('#entry-count').textContent = `${day.length} ${day.length === 1 ? 'entry' : 'entries'}`;
  $('#meals').replaceChildren(...meals.map(meal => {
    const section = element('section', undefined, 'meal');
    const heading = element('div', undefined, 'meal-heading');
    const button = element('button', '+ Add', 'secondary');
    button.type = 'button'; button.disabled = !ready || busy;
    button.setAttribute('aria-label', `Add food to ${meal}`);
    button.onclick = () => openEntry(null, meal);
    heading.append(element('h3', meal[0].toUpperCase() + meal.slice(1)), button);
    section.append(heading);
    const foods = day.filter(entry => entry.meal === meal);
    if (!foods.length) section.append(element('p', 'Nothing logged yet.', 'empty'));
    for (const entry of foods) {
      const row = element('div', undefined, 'entry');
      const details = element('div');
      details.append(element('h4', entry.food_name), element('p', `${format(entry.quantity)} ${units[entry.unit]}${entry.unit === 'serving' ? ' · ' + (entry.serving_label || '1 serving') + (entry.serving_grams ? ' (' + format(entry.serving_grams) + ' g each)' : '') : ''}`), element('p', nutrients.map(key => `${names[key]}: ${entry.snapshot[key] === null ? 'not available' : format(entry.snapshot[key]) + (key === 'energy_kcal' ? ' kcal' : ' g')}`).join(' · ')));
      if (entry.source === 'usda') details.append(element('p', 'USDA food estimate · nutrition saved at logging time'));
      const actions = element('div', undefined, 'entry-actions');
      const edit = element('button', 'Edit', 'secondary');
      const remove = element('button', 'Delete', 'secondary delete');
      edit.type = remove.type = 'button';
      edit.disabled = remove.disabled = busy;
      edit.setAttribute('aria-label', `Edit ${entry.food_name}`); remove.setAttribute('aria-label', `Delete ${entry.food_name}`);
      edit.onclick = () => openEntry(entry);
      remove.onclick = () => deleteEntry(entry);
      actions.append(edit, remove); row.append(details, actions); section.append(row);
    }
    return section;
  }));
  $('#add-open').disabled = $('#goals-open').disabled = $('#calculator-open').disabled = !ready || busy;
}
function openEntry(entry = null, meal = 'breakfast') {
  editing = entry;
  entryForm.reset();
  message('#entry-error', '');
  $('#entry-title').textContent = entry ? 'Edit food' : 'Add food';
  const values = entry ? { ...entry, ...entry.basis } : { diary_date: dateInput.value, meal };
  for (const [key, value] of Object.entries(values)) {
    const field = entryForm.elements.namedItem(key);
    if (field) field.value = value ?? '';
  }
  foodSearch.reset(entry);
  preview(); $('#entry-dialog').showModal();
  entryForm.elements.food_name.focus();
}
function preview() {
  $('#basis-unit').textContent = units[entryForm.elements.unit.value];
  try {
    const values = Object.fromEntries(new FormData(entryForm));
    const result = scale(Object.fromEntries(nutrients.map(key => [key, numberValue(values[key])])), Number(values.quantity), Number(values.basis_quantity));
    $('#preview').textContent = 'For the amount eaten: ' + nutrients.map(key => `${names[key]} ${result[key] === null ? 'not available' : format(result[key]) + (key === 'energy_kcal' ? ' kcal' : ' g')}`).join(' · ');
  } catch { $('#preview').textContent = 'Enter a valid amount and nutrition basis to preview.'; }
}
entryForm.addEventListener('input', preview);
const foodSearch = setupFoodSearch({ form: entryForm, preview, isBusy: () => busy });
$('#entry-dialog').addEventListener('close', () => foodSearch.cancel());
setupGoalCalculator({ isBusy: () => busy, setBusy: value => { busy = value; render(); }, saved: next => { goals = next; notice('Calculated daily targets saved. You can adjust them with Set targets manually.'); render(); } });
entryForm.addEventListener('submit', async event => {
  event.preventDefault(); if (busy) return;
  message('#entry-error', '');
  let entry;
  try { entry = makeEntry({ ...Object.fromEntries(new FormData(entryForm)), reference: foodSearch.reference() }, editing); }
  catch (error) { message('#entry-error', error.message); return; }
  busy = true; $('#save-entry').disabled = true; foodSearch.cancel();
  try {
    await storage.save(entry);
    entries = [...entries.filter(item => item.id !== entry.id), entry];
    dateInput.value = entry.diary_date;
    $('#entry-dialog').close(); notice(editing ? 'Food updated.' : 'Food saved.');
  } catch { message('#entry-error', 'Could not save to browser storage. Your form is preserved. Free space or enable browser storage, then retry.'); }
  finally { busy = false; $('#save-entry').disabled = false; render(); }
});
async function deleteEntry(entry) {
  if (busy) return;
  busy = true; render();
  try {
    await storage.remove(entry.id);
    entries = entries.filter(item => item.id !== entry.id);
    deleted = entry;
    notice(`${entry.food_name} deleted.`);
    const undo = element('button', 'Undo', 'secondary');
    undo.onclick = async () => {
      if (!deleted || busy) return;
      const restore = deleted; busy = true; undo.disabled = true; render();
      try { await storage.save(restore); entries.push(restore); deleted = null; notice('Food restored.'); message('#error', ''); }
      catch { message('#error', 'Could not restore the entry. Try Undo again.'); undo.disabled = false; }
      finally { busy = false; render(); }
    };
    $('#notice').append(undo);
    message('#error', '');
  } catch { message('#error', 'Could not delete the entry. It is still in your diary. Try again.'); }
  finally { busy = false; render(); }
}
$('#goals-open').onclick = () => {
  const form = $('#goals-form'); form.reset();
  for (const key of nutrients) form.elements[key].value = goals[key] ?? '';
  message('#goals-error', ''); $('#goals-dialog').showModal();
};
$('#goals-form').onsubmit = async event => {
  event.preventDefault(); if (busy) return;
  let next;
  try { const values = Object.fromEntries(new FormData(event.target)); next = Object.fromEntries(nutrients.map(key => [key, numberValue(values[key])])); }
  catch (error) { message('#goals-error', error.message); return; }
  busy = true; $('#save-goals').disabled = true;
  try { await storage.saveGoals(next); goals = next; $('#goals-dialog').close(); notice('Daily targets saved.'); }
  catch { message('#goals-error', 'Could not save targets. Your values are preserved; try again.'); }
  finally { busy = false; $('#save-goals').disabled = false; render(); }
};
$('#entry-close').onclick = () => { if (!busy) $('#entry-dialog').close(); };
$('#goals-close').onclick = () => { if (!busy) $('#goals-dialog').close(); };
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
$('#add-open').onclick = () => openEntry();
dateInput.value = localDate();
dateInput.onchange = () => { if (!dateInput.value || !dateInput.validity.valid) dateInput.value = localDate(); render(); };
$('#today').onclick = () => { dateInput.value = localDate(); render(); };
async function load() {
  ready = false; render();
  try {
    [entries, goals] = await Promise.all([storage.list(), storage.goals().then(value => value || {})]);
    ready = true; message('#error', ''); $('#retry').hidden = true;
  } catch { message('#error', 'Could not load browser storage. Enable storage or close other tracker tabs, then retry.'); $('#retry').hidden = false; }
  render();
}
$('#retry').onclick = load;
// Refresh after edits made in another tab; each entry is stored independently.
window.addEventListener('focus', () => { if (!busy && !document.querySelector('dialog[open]')) load(); });
load();
