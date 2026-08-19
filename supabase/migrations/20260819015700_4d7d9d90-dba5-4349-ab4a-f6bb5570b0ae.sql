UPDATE auto_email_templates
SET body = replace(
  replace(
    body,
    '<strong>Arrival Time:</strong> <u><strong>{{arrivalTime}}</strong></u> (class ends at {{classEndTime}})',
    '<strong>Arrive No Later Than:</strong> <u><strong>{{arrivalTime}}</strong></u> (class ends at {{classEndTime}})'
  ),
  'Please arrive at <u><strong>{{arrivalTime}}</strong></u> — no earlier and no later. If you arrive late you will <u><strong>NOT BE ADMITTED</strong></u> and will need to call our office at (805) 827-0075 to reschedule.',
  'Please arrive <u><strong>no later than {{arrivalTime}}</strong></u>, unless our office has given you a different time. If you arrive after that time you will <u><strong>NOT BE ADMITTED</strong></u> and will need to call our office at (805) 827-0075 to reschedule.

<strong>Please note:</strong> arriving early will <u><strong>not</strong></u> result in an earlier retest. Retests are conducted during the final riding evaluation near the end of class (approximately {{classEndTime}}), so riders who arrive ahead of time will simply wait until that portion of the class begins.'
)
WHERE trigger_event = 'retest_scheduled';