import { calculateGoals } from './goals.js';
import { storage } from './storage.js';

export function setupGoalCalculator({ isBusy, setBusy, saved }) {
  const $ = selector => document.querySelector(selector);
  const form = $('#calculator-form'), dialog = $('#calculator-dialog'), result = $('#calculator-result');
  let estimate = null, profile = null, loading = false, opening = 0;
  const format = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
  function error(text) { $('#calculator-error').textContent = text; $('#calculator-error').hidden = !text; }
  function invalidate() {
    estimate = null; profile = null; result.hidden = true; $('#calculator-apply').hidden = true; error('');
  }
  function units() {
    const metric = form.elements.measurement.value === 'metric';
    $('#metric-fields').hidden = !metric; $('#us-fields').hidden = metric;
    for (const field of $('#metric-fields').querySelectorAll('input')) { field.disabled = !metric; field.required = metric; }
    for (const field of $('#us-fields').querySelectorAll('input')) { field.disabled = metric; field.required = !metric; }
  }
  form.addEventListener('input', invalidate);
  form.elements.measurement.addEventListener('change', () => { units(); invalidate(); });
  $('#calculator-open').onclick = async () => {
    if (isBusy() || loading) return;
    loading = true; const version = ++opening;
    form.reset(); units(); invalidate(); dialog.showModal();
    for (const control of form.elements) control.disabled = true;
    try {
      const previous = await storage.calculator();
      if (version !== opening || !dialog.open) return;
      if (previous) for (const [key, value] of Object.entries(previous)) {
        const field = form.elements.namedItem(key); if (field) field.value = value;
      }
      units(); form.elements.age.focus();
    } catch { error('Could not load saved calculator inputs. You can still enter new values.'); }
    finally {
      loading = false;
      for (const control of form.elements) control.disabled = false;
      units();
      if (dialog.open) form.elements.age.focus();
    }
  };
  form.onsubmit = event => {
    event.preventDefault(); if (isBusy()) return;
    invalidate();
    try {
      profile = Object.fromEntries(new FormData(form)); estimate = calculateGoals(profile);
      result.replaceChildren();
      const heading = document.createElement('h3'); heading.textContent = 'Your daily estimate'; result.append(heading);
      const list = document.createElement('dl'); list.className = 'estimate-grid';
      for (const [label, value] of [['Maintenance calories', `${format(estimate.goals.energy_kcal)} kcal`], ['Protein target', `${format(estimate.goals.protein_g)} g`], ['Carbs target', `${format(estimate.goals.carbs_g)} g`], ['Fat target', `${format(estimate.goals.fat_g)} g`]]) {
        const group = document.createElement('div'), term = document.createElement('dt'), definition = document.createElement('dd');
        term.textContent = label; definition.textContent = value; group.append(term, definition); list.append(group);
      }
      result.append(list);
      for (const text of [
        `Resting energy estimate: ${format(estimate.resting)} kcal × activity factor ${estimate.activity_factor}.`,
        `Protein reference (0.8 g/kg): ${format(estimate.protein_reference_g)} g/day. Your target above follows the chosen ${estimate.split.protein}% calorie split.`,
        `Adult calorie-based ranges: protein ${estimate.ranges.protein_g.map(format).join('–')} g; carbs ${estimate.ranges.carbs_g.map(format).join('–')} g; fat ${estimate.ranges.fat_g.map(format).join('–')} g. These ranges are separate references, not a combined meal plan.`,
        ...(estimate.goals.protein_g < estimate.protein_reference_g ? ['Your chosen protein split is below the weight-based reference. Increase protein within the allowed ranges or review manual targets with a qualified professional.'] : []),
      ]) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = text; result.append(p); }
      result.hidden = false; $('#calculator-apply').hidden = false;
    } catch (reason) { error(reason.message); }
  };
  $('#calculator-apply').onclick = async () => {
    if (!estimate || !profile || isBusy()) return;
    const next = estimate.goals, inputs = profile;
    setBusy(true); $('#calculator-apply').disabled = true;
    try { await storage.saveCalculatedGoals(next, inputs); dialog.close(); saved(next); }
    catch { error('Could not save targets. The estimate is preserved; try again.'); }
    finally { setBusy(false); $('#calculator-apply').disabled = false; }
  };
  $('#calculator-close').onclick = () => { if (!isBusy()) { opening++; dialog.close(); } };
}
