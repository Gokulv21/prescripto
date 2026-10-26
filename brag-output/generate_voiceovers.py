import asyncio
import edge_tts
import os

VOICE = "en-US-AndrewMultilingualNeural" # Confident, natural, tech-product voice

SCRIPTS = {
    "feat1_stylus": (
        "Tired of clunky medical software slowing down your consultations? "
        "Meet PreScripto's Digital Stylus Prescription Pad. "
        "Write prescriptions naturally with your stylus, tap to add dosage chips, "
        "track patient vitals in real time, and sign digitally with zero delay. "
        "Fast, paperless, and effortless."
    ),
    "feat2_tvdisplay": (
        "No more crowded waiting rooms or staff shouting patient names. "
        "PreScripto turns any smart screen into an intelligent waiting hall TV display. "
        "Patients see their live token number, assigned doctor cabin, and hear an automatic audio chime "
        "the second you click next patient. Calm clinic, happy patients."
    ),
    "feat3_printqueue": (
        "Say goodbye to frozen printer dialogs and counter delays. "
        "PreScripto features a dedicated sub-second hardware print queue. "
        "Dispatch three-inch thermal receipts or full-page official A4 prescriptions instantly with a single click. "
        "Lightning-fast checkout for every patient."
    ),
    "feat4_novaai": (
        "What if your clinic had an AI copilot that understands your clinical workflow? "
        "Nova AI brings intelligent practice analytics right into PreScripto. "
        "Ask in English or Tamil about daily patient footfalls, peak waiting hours, or department revenue, "
        "and get instant clinical answers. Practice smarter with Nova AI."
    ),
    "feat5_nursetriage": (
        "Check in walk-in patients and capture vitals in under thirty seconds. "
        "PreScripto's Nurse Triage Desk lets front-desk staff register patients, auto-generate sequential tokens, "
        "and log blood pressure, pulse, and BMI with zero friction. "
        "Streamline patient intake before the doctor even opens the door."
    ),
    "feat6_multiclinic": (
        "Manage multiple clinic locations and hospital practices from one unified cloud dashboard. "
        "PreScripto enforces strict database row-level security, complete branch data isolation, "
        "and granular doctor-staff permissions. "
        "Your clinical records remain completely private, isolated, and secure."
    )
}

async def generate_all():
    os.makedirs("brag-output/voiceovers", exist_ok=True)
    for key, text in SCRIPTS.items():
        out_path = f"brag-output/voiceovers/{key}.mp3"
        print(f"Generating {out_path}...")
        communicate = edge_tts.Communicate(text, VOICE, rate="+3%")
        await communicate.save(out_path)
        print(f"[OK] Saved {out_path}")

if __name__ == "__main__":
    asyncio.run(generate_all())
