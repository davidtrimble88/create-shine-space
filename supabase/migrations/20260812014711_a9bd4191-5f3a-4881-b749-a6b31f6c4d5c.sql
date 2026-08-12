UPDATE public.auto_email_templates
SET body = replace(
  body,
  'Please review the entry skills test video before class day:<br><a href="https://youtu.be/sTPMKDZ8Uw0?feature=shared" target="_blank" rel="noopener noreferrer">https://youtu.be/sTPMKDZ8Uw0?feature=shared</a>',
  'Please review the entry skills test video before class day:<br><br><a href="https://youtu.be/sTPMKDZ8Uw0" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none"><img src="https://img.youtube.com/vi/sTPMKDZ8Uw0/hqdefault.jpg" alt="Watch the entry skills test video" width="480" style="display:block;max-width:100%;border:1px solid #ddd;border-radius:8px" /><span style="display:inline-block;margin-top:8px;background:#e8590c;color:#ffffff;padding:10px 18px;border-radius:6px;font-weight:bold">▶ Watch the Entry Skills Test Video</span></a>'
)
WHERE match_course = '1dpc';