"""Offline Whisper adapter; stdout is JSON only. Model must be installed beforehand."""
import sys,json,os
from faster_whisper import WhisperModel
model=WhisperModel(os.environ.get('DAU_ANH_WHISPER_MODEL','small'),device='cpu',compute_type='int8',local_files_only=True)
segments,_=model.transcribe(sys.argv[1],language='vi',vad_filter=True)
print(json.dumps([{'text':s.text.strip(),'startMs':round(s.start*1000),'endMs':round(s.end*1000),'timestampMs':round((s.start+s.end)*500),'confidence':None} for s in segments if s.text.strip()],ensure_ascii=False))
