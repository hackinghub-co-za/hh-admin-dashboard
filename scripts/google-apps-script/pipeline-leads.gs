/**
 * Hacking Hub - automatic Sales Pipeline leads (Google Apps Script)
 *
 * What it does:
 *   Every time someone submits the Elite Operative application Google
 *   Form, it adds them to the Sales Pipeline as a Lead, with their answers
 *   in the card's notes. (Calls booked on Cal.com reach the pipeline through
 *   the cal-booking-webhook function instead, with no script needed.)
 *
 * Set up (about 3 minutes):
 *   1. Go to https://script.google.com while signed in as the Google
 *      account that owns the Elite Operative form, and click New project.
 *      (Or open the form's editor > three dots > Apps Script.)
 *   2. Paste this whole file over the default code and fill in SECRET below.
 *   3. Pick the function "setup" in the toolbar and click Run. Google asks
 *      you to authorise it (Advanced > Go to project). This connects the
 *      form. You only run setup once.
 *
 * The secret below must match the PIPELINE_INTAKE_SECRET set in Supabase.
 * Never share this script after the secret is filled in.
 */

var CONFIG = {
  // The Supabase Edge Function that receives leads.
  WEBHOOK_URL: 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/pipeline-lead-intake',
  // Must match the PIPELINE_INTAKE_SECRET in Supabase.
  SECRET: 'PASTE_THE_SECRET_HERE',
  // The Elite Operative application form: the text between /d/ and /edit
  // in its EDITOR link (the link people fill in uses a different ID that
  // does not work here). Leave empty if you open this script from the form
  // itself (three dots > Apps Script) and want it to use that form.
  FORM_ID: '1VzHgycZUzxFK5RNMhJa9lEzki6tmnyh2Rk93qqfTBwY'
};

// ---------- one-time setup ----------

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  var form = CONFIG.FORM_ID ? FormApp.openById(CONFIG.FORM_ID) : FormApp.getActiveForm();
  if (!form) throw new Error('Open this script from the form (three dots > Apps Script), or set FORM_ID.');
  ScriptApp.newTrigger('onEliteApplication').forForm(form).onFormSubmit().create();
  Logger.log('Connected to the form: ' + form.getTitle());
}

// ---------- Elite Operative application form ----------

function onEliteApplication(e) {
  var response = e.response;
  var answers = {};
  response.getItemResponses().forEach(function (r) {
    answers[r.getItem().getTitle()] = r.getResponse();
  });

  var email = '';
  try { email = response.getRespondentEmail() || ''; } catch (err) { /* email collection is off */ }
  var name = '';
  var phone = '';
  Object.keys(answers).forEach(function (title) {
    var value = String(answers[title] || '').trim();
    if (!email && /e-?mail/i.test(title) && value.indexOf('@') > -1) email = value;
    else if (!name && /name/i.test(title) && !/company|employer|school/i.test(title)) name = value;
    else if (!phone && /phone|whatsapp|cell|mobile|contact number/i.test(title)) phone = value;
  });

  post_({
    source: 'elite_application',
    ref: 'form:' + response.getId(),
    name: name,
    email: email,
    phone: phone,
    answers: answers
  });
}

// ---------- shared ----------

function post_(payload) {
  try {
    var res = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-intake-secret': CONFIG.SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) return true;
    Logger.log('Lead not delivered (' + code + '): ' + res.getContentText());
    return false;
  } catch (err) {
    Logger.log('Lead not delivered: ' + err);
    return false;
  }
}
