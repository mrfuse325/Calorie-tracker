export const activityLevels = {
  sedentary: { label: 'Little or no exercise', factor: 1.2 },
  light: { label: 'Light activity · 1–3 days/week', factor: 1.375 },
  some: { label: 'Exercise · 4–5 days/week', factor: 1.465 },
  moderate: { label: 'Moderate activity · 3–5 days/week', factor: 1.55 },
  active: { label: 'Very active · 6–7 days/week', factor: 1.725 },
  extra: { label: 'Very strenuous activity / physical job', factor: 1.9 },
};
export const lossRates = [0, 0.5, 1, 2];

function bounded(value, label, min, max) {
  if (value === '' || value === null || value === undefined) throw Error(`Enter ${label}.`);
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw Error(`${label} must be between ${min} and ${max}.`);
  return number;
}

export function calculateGoals(values) {
  const age = bounded(values.age, 'Age', 19, 80);
  if (!Number.isInteger(age)) throw Error('Enter age in whole years.');
  if (!['male', 'female'].includes(values.sex)) throw Error('Select the sex coefficient used by the equation.');
  if (!['metric', 'us'].includes(values.measurement)) throw Error('Select metric or US units.');
  let height, weight;
  if (values.measurement === 'us') {
    const feet = bounded(values.feet, 'Height in feet', 3, 8);
    if (!Number.isInteger(feet)) throw Error('Enter whole feet and use inches for the remainder.');
    const inches = bounded(values.inches, 'Height in inches', 0, 11.99);
    height = (feet * 12 + inches) * 2.54;
    weight = bounded(values.pounds, 'Weight in pounds', 66, 662) * 0.45359237;
  } else {
    height = bounded(values.height_cm, 'Height in centimeters', 100, 250);
    weight = bounded(values.weight_kg, 'Weight in kilograms', 30, 300);
  }
  bounded(height, 'Converted height in centimeters', 100, 250);
  bounded(weight, 'Converted weight in kilograms', 30, 300);
  const activity = activityLevels[values.activity];
  if (!activity) throw Error('Choose an activity level.');
  const split = {
    protein: bounded(values.protein_percent, 'Protein percentage', 10, 35),
    carbs: bounded(values.carbs_percent, 'Carbohydrate percentage', 45, 65),
    fat: bounded(values.fat_percent, 'Fat percentage', 20, 35),
  };
  if (Math.abs(split.protein + split.carbs + split.fat - 100) > 0.000001) throw Error('Macro percentages must add up to 100%.');
  const resting = 10 * weight + 6.25 * height - 5 * age + (values.sex === 'male' ? 5 : -161);
  if (resting <= 0) throw Error('These inputs do not produce a usable estimate. Use manual targets instead.');
  const maintenance = Math.round(resting * activity.factor);
  const rate = values.loss_rate === undefined ? 0 : bounded(values.loss_rate, 'Weekly loss in pounds', 0, 2);
  if (!lossRates.includes(rate)) throw Error('Choose maintenance, 0.5, 1, or 2 pounds per week.');
  // Same simple 3,500 kcal/lb convention as the reference calculator; not a
  // prediction of actual weight change, which varies with metabolic adaptation.
  const deficit = rate * 3500 / 7;
  const calories = maintenance - deficit;
  const minimum = values.sex === 'male' ? 1500 : 1200;
  const bmi = weight / ((height / 100) ** 2);
  const options = lossRates.map(loss_rate => {
    const daily_deficit = loss_rate * 500;
    const target = maintenance - daily_deficit;
    const reason = target <= 0 ? 'No usable calorie target.' : loss_rate > 0 && bmi < 18.5 ? 'Weight-loss targets are unavailable for an underweight BMI.' : loss_rate > 0 && target < minimum ? `Below the app’s ${minimum} kcal/day automatic weight-loss limit. Choose a slower rate or seek professional guidance.` : null;
    return { loss_rate, daily_deficit, calories: target, eligible: !reason, reason };
  });
  const selectedOption = options.find(option => option.loss_rate === rate);
  const goals = {
    energy_kcal: calories,
    protein_g: calories * split.protein / 100 / 4,
    carbs_g: calories * split.carbs / 100 / 4,
    fat_g: calories * split.fat / 100 / 9,
  };
  return {
    goals, resting, maintenance_kcal: maintenance, loss_rate: rate, daily_deficit: deficit, options, can_apply: selectedOption.eligible, restriction: selectedOption.reason, weight_kg: weight, height_cm: height, activity_factor: activity.factor, split,
    protein_reference_g: weight * 0.8,
    ranges: {
      protein_g: [calories * 0.1 / 4, calories * 0.35 / 4],
      carbs_g: [calories * 0.45 / 4, calories * 0.65 / 4],
      fat_g: [calories * 0.2 / 9, calories * 0.35 / 9],
    },
  };
}
