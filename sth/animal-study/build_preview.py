"""Inject the mocap data (kept on D:) into dog3d.template.html -> the preview page on D:."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
WORK = os.environ.get("MOCAP_WORK", r"D:\mocap-trial\work")
OUT = os.environ.get("MOCAP_PREVIEW", r"D:\mocap-trial\preview\dog3d.html")
page = open(os.path.join(HERE, "dog3d.template.html"), encoding="utf-8").read()
data = open(os.path.join(WORK, "mocap_dog.json"), encoding="utf-8").read()
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(page.replace("/*MOCAP*/null", data))
print("wrote", OUT)
