# Module Documentation: ai/

**Owner:** Developer A
**Depends on:** an LLM API key in `.env` (e.g. `ANTHROPIC_API_KEY`)
**Used by:** `services/commitment_service.py` (extractor), `services/meeting_service.py` (summarizer)

This is the only part of the backend allowed to call an external AI model. Everything here should return **structured, validated data** — never a raw sentence the rest of the app has to guess how to interpret. Per the architecture rules: this layer does language understanding only, never dates/math/conflict-checking — those stay in `services/`.

**Build order:** `llm_client.py` first (everything else calls through it), then `prompts/` (the text templates), then `extractor.py` and `summarizer.py` (which use both).

---

## 1. `ai/llm_client.py`

### Purpose
A single, thin wrapper around the actual LLM API call. Every other AI file goes through this instead of calling the API directly — so the API key, model name, retry logic, and error handling live in exactly one place.

### Input
- `system_prompt: str` — instructions for how the model should behave
- `user_prompt: str` — the actual content to process (a sentence, a transcript)
- Optional: `max_tokens`, `temperature`

### Output
The raw text response from the model (as a string). Parsing that text into structured data happens one level up, in `extractor.py`/`summarizer.py` — this file's only job is "send a prompt, get text back, reliably."

### How to build it
```python
# ai/llm_client.py
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

def call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 1000) -> str:
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return response.content[0].text
```

Keep this function boring on purpose — no prompt text lives here, only the mechanics of making the call.

### How it fits with everything else
```
extractor.py  --\
                 +--> call_llm(system, user)  -->  Anthropic API  -->  raw text back
summarizer.py --/
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Call with a simple prompt ("say hello") | Returns a non-empty string |
| 2 | Call with `ANTHROPIC_API_KEY` unset/invalid | Raises a clear authentication error, not a silent failure |
| 3 | Call with an unusually long `user_prompt` (near token limits) | Either succeeds or raises a clear, catchable error — not a hang |
| 4 | Call twice with the same input | Both calls succeed independently — proves the client isn't holding bad state between calls |

---

## 2. `ai/prompts/`

### Purpose
Keeps the actual instruction text for each AI task in its own file, separate from the Python logic that uses it. This matters because prompt wording is something you'll tune repeatedly during the hackathon as you see what the model gets wrong — you don't want to be editing Python code every time you tweak a sentence.

### Input
None — these are static template files, not executable code.

### Output
Prompt template strings, imported by `extractor.py` and `summarizer.py`.

### How to build it
```text
# ai/prompts/commitment_extraction.txt
You extract commitments from short pieces of text.
A commitment is something the user promised to do for someone else.

Return ONLY valid JSON in this exact shape, nothing else:
{{
  "person": "string or null if no person mentioned",
  "task": "string describing what was promised",
  "deadline": "string, e.g. 'tomorrow' or a date, or null if none mentioned",
  "confidence": "float between 0 and 1",
  "source_reference": "the exact sentence this was extracted from"
}}

If the text contains no commitment, return:
{{"person": null, "task": null, "deadline": null, "confidence": 0.0, "source_reference": null}}

Text: {text}
```

```text
# ai/prompts/meeting_summary.txt
You summarize meeting transcripts. Only include information that is
explicitly present in the transcript. Do not invent decisions or
action items that were not actually discussed.

Return ONLY valid JSON in this exact shape:
{{
  "summary": "1-3 sentence summary",
  "decisions": ["explicit decisions made, each grounded in the transcript"],
  "action_items": [{{"person": "string", "task": "string", "deadline": "string or null"}}],
  "unresolved_questions": ["questions raised but not answered"]
}}

Transcript: {transcript}
```

```python
# ai/prompts/__init__.py
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent

def load_prompt(filename: str, **kwargs) -> str:
    text = (PROMPTS_DIR / filename).read_text()
    return text.format(**kwargs)
```

### How it fits with everything else
```
extractor.py  -->  load_prompt("commitment_extraction.txt", text=user_text)
                          |
                          v
                    filled-in prompt string  -->  llm_client.call_llm()
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | `load_prompt("commitment_extraction.txt", text="hello")` | Returns the template with `{text}` correctly replaced by `"hello"` |
| 2 | Call `load_prompt` with a missing placeholder value | Raises a clear `KeyError`, not a silently broken prompt |
| 3 | Edit the `.txt` file's wording | No Python code needs to change for the new wording to take effect |

---

## 3. `ai/extractor.py`

### Purpose
Given a piece of text, asks the model to identify a commitment and return it as structured data.

### Input
`text: str` — the sentence or short passage to extract from.

### Output
A dict: `{ "person": str|None, "task": str|None, "deadline": str|None, "confidence": float, "source_reference": str|None }`

### How to build it
```python
# ai/extractor.py
import json
from app.ai.llm_client import call_llm
from app.ai.prompts import load_prompt

def extract_commitment(text: str) -> dict:
    prompt = load_prompt("commitment_extraction.txt", text=text)
    raw_response = call_llm(
        system_prompt="You only return valid JSON, no other text.",
        user_prompt=prompt,
    )

    try:
        result = json.loads(raw_response)
    except json.JSONDecodeError:
        raise ValueError(f"AI did not return valid JSON: {raw_response}")

    required = {"person", "task", "deadline", "confidence", "source_reference"}
    if not required.issubset(result.keys()):
        raise ValueError(f"AI response missing required fields: {result}")

    # grounding check: the source sentence should actually appear in the input text
    if result.get("source_reference") and result["source_reference"] not in text:
        result["confidence"] = 0.0  # can't verify it — treat as unreliable

    return result
```

### How it fits with everything else
```
commitment_service.py calls extract_commitment(text)
        |
        v
gets back structured dict with a confidence score
        |
        v
commitment_service.py decides: auto-save or ask for confirmation
(this file never touches the database directly)
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | `"I'll send Rahul the schema tomorrow"` | Returns `person="Rahul"`, `task` mentions the schema, `deadline` relates to tomorrow, reasonable confidence |
| 2 | `"The weather is nice today"` (no commitment) | Returns the "no commitment found" shape with `confidence=0.0` |
| 3 | Model returns malformed JSON (simulate by mocking `call_llm`) | Raises a clear `ValueError`, doesn't crash silently or save garbage |
| 4 | Model returns valid JSON but missing the `confidence` field | Raises a clear `ValueError` naming the missing field |
| 5 | Model returns a `source_reference` that doesn't actually appear in the input text | `confidence` is forced to `0.0` regardless of what the model claimed |

---

## 4. `ai/summarizer.py`

### Purpose
Given a full meeting transcript, produces a summary, a list of decisions, action items, and unresolved questions — with a grounding check to reduce the chance of the model inventing decisions that were never actually made.

### Input
`transcript: str`

### Output
```json
{
  "summary": "string",
  "decisions": ["string", ...],
  "action_items": [{ "person": "string", "task": "string", "deadline": "string|null" }],
  "unresolved_questions": ["string", ...]
}
```

### How to build it
```python
# ai/summarizer.py
import json
from app.ai.llm_client import call_llm
from app.ai.prompts import load_prompt

def summarize_transcript(transcript: str) -> dict:
    prompt = load_prompt("meeting_summary.txt", transcript=transcript)
    raw_response = call_llm(
        system_prompt="You only return valid JSON, no other text.",
        user_prompt=prompt,
        max_tokens=1500,
    )

    try:
        result = json.loads(raw_response)
    except json.JSONDecodeError:
        raise ValueError(f"AI did not return valid JSON: {raw_response}")

    for key in ("summary", "decisions", "action_items", "unresolved_questions"):
        if key not in result:
            raise ValueError(f"AI response missing '{key}': {result}")

    # simple grounding pass: drop decisions whose key words don't appear
    # anywhere in the transcript at all (loose but catches obvious invention)
    transcript_lower = transcript.lower()
    result["decisions"] = [
        d for d in result["decisions"]
        if any(word in transcript_lower for word in d.lower().split()[:5])
    ]

    return result
```

*(This grounding check is intentionally simple for MVP — a stronger version would ask the model to also return the exact transcript sentence supporting each decision, the same pattern used in `extractor.py`, and validate that sentence actually appears in the transcript.)*

### How it fits with everything else
```
meeting_service.py calls summarize_transcript(transcript)
        |
        v
gets back summary + decisions + action_items + unresolved_questions
        |
        v
meeting_service.py saves Meeting.summary, creates Decision rows,
creates Commitment/Task rows for action items
(this file never touches the database directly)
```

### Test cases
| # | Test | Expected result |
|---|---|---|
| 1 | Transcript clearly stating "we decided to use PostgreSQL" | `decisions` includes something about PostgreSQL |
| 2 | Transcript with an action item ("Rahul will benchmark Postgres by Friday") | `action_items` includes `person="Rahul"`, correct task/deadline |
| 3 | Transcript with pure small talk, no decisions | `decisions` and `action_items` are empty lists, not fabricated content |
| 4 | Model returns a decision about a topic never mentioned in the transcript (simulate by mocking) | Grounding check filters it out of the final `decisions` list |
| 5 | Model returns malformed JSON | Raises a clear `ValueError`, not a partial/corrupted save downstream |

---

## Quick sanity checklist before moving on to integrating with `services/`

- [ ] `llm_client.py` contains zero prompt text — only the mechanics of the API call
- [ ] Every prompt explicitly instructs "return ONLY valid JSON" — this is what makes reliable parsing possible
- [ ] Both `extractor.py` and `summarizer.py` raise clear errors on malformed/incomplete AI output rather than saving partial data
- [ ] Both files have some form of grounding check (confirming extracted claims actually trace back to the source text) before returning results
- [ ] None of these three files import anything from `database/` or `models/` — they should have zero awareness that a database exists
