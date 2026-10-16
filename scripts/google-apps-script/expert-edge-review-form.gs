/**
 * Expert Edge review form for Hacking Hub members.
 *
 * Creates the whole Google Form (sections, questions, ratings grid, confirmation
 * message) and a linked Google Sheet for the responses, then logs the links.
 *
 * How to use it:
 *   1. Go to https://script.google.com and create a new project.
 *   2. Paste this whole file in, replacing what is there, and save.
 *   3. Pick "createExpertEdgeReviewForm" in the function menu and click Run.
 *   4. Approve the permissions when asked (it needs to create a Form and a Sheet
 *      in your Google Drive).
 *   5. Open View > Logs: it prints the link to share with members, the link to
 *      edit the form, and the link to the responses sheet.
 *
 * It creates a NEW form every time it runs, so run it once. To change a question
 * later, edit the form in Google Forms; do not run this again.
 *
 * Nothing here is specific to what Expert Edge offers, because the platform's
 * pages are not readable without signing in. Members say what they used, so
 * edit the "What did you use" choices if you know the exact features.
 */
function createExpertEdgeReviewForm() {
  var form = FormApp.create('Expert Edge review, for Hacking Hub members');

  form.setDescription(
    'Hacking Hub has partnered with Expert Edge, an online platform for cybersecurity and tech courses. ' +
    'We want your honest opinion, including the bad parts: it is how we decide what to recommend and it ' +
    'helps Expert Edge improve. It takes about 5 minutes.\n\n' +
    'Platform: https://app.expertedge.org/roles/cybersecurity-analyst'
  );
  form.setConfirmationMessage('Thank you. Your review helps Hacking Hub and Expert Edge make this better for the next member.');
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);
  form.setAllowResponseEdits(false);
  form.setAcceptingResponses(true);

  // ---------- 1. About you ----------
  form.addPageBreakItem().setTitle('About you');

  form.addTextItem().setTitle('Your name').setRequired(true);

  form.addTextItem()
    .setTitle('Your email (optional)')
    .setHelpText('Only used if we want to follow up on something you wrote. Leave it blank if you prefer.')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  form.addMultipleChoiceItem()
    .setTitle('Where are you in your cybersecurity journey?')
    .setChoiceValues([
      'Just starting',
      'Studying for my first cybersecurity role',
      'Working in cybersecurity, under 2 years',
      'Working in cybersecurity, 2 years or more'
    ])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Which Hacking Hub roadmap track are you on?')
    .setChoiceValues([
      'SOC',
      'Cloud Security',
      'Offensive Security',
      'DevSecOps',
      'IAM',
      'AI Security',
      'GRC',
      'Network Security',
      'Not assigned or not sure yet'
    ])
    .setRequired(true);

  // ---------- 2. What you used ----------
  form.addPageBreakItem().setTitle('What you used');

  form.addParagraphTextItem()
    .setTitle('Which learning path or courses did you try on Expert Edge?')
    .setHelpText('For example the Cybersecurity Analyst role path, or the names of individual courses.')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How long have you been using it?')
    .setChoiceValues(['Less than a week', '1 to 4 weeks', '1 to 3 months', 'More than 3 months'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('About how many hours a week did you spend on it?')
    .setChoiceValues(['Less than 1 hour', '1 to 3 hours', '3 to 6 hours', 'More than 6 hours'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('How much of what you started did you finish?')
    .setChoiceValues([
      'I only looked around',
      'Less than a quarter',
      'About half',
      'Most of it',
      'All of it'
    ])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Which parts did you use?')
    .setChoiceValues([
      'Video lessons',
      'Hands-on labs',
      'Quizzes and tests',
      'Projects',
      'Practice exams',
      'Certificate of completion',
      'Career or role guidance'
    ])
    .showOtherOption(true)
    .setRequired(true);

  // ---------- 3. Ratings ----------
  form.addPageBreakItem()
    .setTitle('Your ratings')
    .setHelpText('1 is poor and 5 is excellent. Choose "Did not use" for anything you did not try.');

  form.addGridItem()
    .setTitle('Rate each of these')
    .setRows([
      'Quality of the course content',
      'How clearly it teaches',
      'Hands-on practice (labs and projects)',
      'Relevance to real cybersecurity jobs',
      'Ease of using the platform',
      'Videos and labs working without problems',
      'Help when you got stuck',
      'Value for the price'
    ])
    .setColumns(['1 Poor', '2', '3', '4', '5 Excellent', 'Did not use'])
    .setRequired(true);

  // ---------- 4. Comparison and results ----------
  form.addPageBreakItem().setTitle('How it compares');

  form.addMultipleChoiceItem()
    .setTitle('Compared with other platforms you have used, Expert Edge is...')
    .setChoiceValues(['Better', 'About the same', 'Worse', 'I have not used other platforms'])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle('Which other platforms have you used? (optional)')
    .setChoiceValues([
      'Udemy',
      'Coursera',
      'TryHackMe',
      'Immersive Labs',
      'Cisco NetAcad',
      'KodeKloud',
      'YouTube'
    ])
    .showOtherOption(true);

  form.addCheckboxItem()
    .setTitle('Has it helped you with any of these?')
    .setChoiceValues([
      'Passing a certification exam',
      'Preparing for a job interview',
      'Learning a new skill for my job',
      'Building a portfolio project',
      'Landing a job',
      'Nothing yet'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Would you pay for it yourself?')
    .setChoiceValues([
      'Yes, at the current price',
      'Yes, if it cost less',
      'Only with a discount or scholarship',
      'No'
    ])
    .setRequired(true);

  form.addTextItem()
    .setTitle('What would a fair price be, in rand? (optional)')
    .setHelpText('A monthly or a one-off amount, whichever you would expect.');

  form.addScaleItem()
    .setTitle('How likely are you to recommend Expert Edge to someone starting in cybersecurity?')
    .setBounds(0, 10)
    .setLabels('Not at all likely', 'Extremely likely')
    .setRequired(true);

  // ---------- 5. In your words ----------
  form.addPageBreakItem().setTitle('In your words');

  form.addParagraphTextItem().setTitle('What did you like most?').setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What should Expert Edge fix or add first?')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('Which topics or certifications are missing that you would want? (optional)');

  form.addMultipleChoiceItem()
    .setTitle('Who may see your answers?')
    .setHelpText('Hacking Hub reads every response. We may pass feedback on to Expert Edge so they can improve the platform.')
    .setChoiceValues([
      'Hacking Hub and Expert Edge may see it, with my name',
      'Hacking Hub and Expert Edge may see it, without my name',
      'Hacking Hub only'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('May we quote part of your review in our marketing?')
    .setChoiceValues(['Yes, with my name', 'Yes, without my name', 'No'])
    .setRequired(true);

  form.addParagraphTextItem().setTitle('Anything else? (optional)');

  // ---------- Responses sheet ----------
  var sheet = SpreadsheetApp.create('Expert Edge review responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Share this link with members: ' + form.getPublishedUrl());
  Logger.log('Edit the form here: ' + form.getEditUrl());
  Logger.log('Responses sheet: ' + sheet.getUrl());
}
