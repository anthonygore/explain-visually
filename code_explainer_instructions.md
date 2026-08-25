1. Overview

The input is an explanation of a software concept, for example, how an app functionality, piece of code, or system architecture works.

The job is to turn it into a "presentation" which consists of interconnected "segments" that include a "narration" and a "scene".

2. Presentation

The complete output which consists of ordered segments.

3. Segment

Consists of the narration and an accompanying scene.

4. Narration

The voice over. A text artifact which may be turned into voice using text-to-speech. So it should only consist of "speakable" text.

5. Scene

The visual aspect. Can take a variety of forms:

- Title
- Bullet points
- Diagrams
- Code snippets

Will usually contain some kind of animation.

The output artifact is not video, though, it's a code-scene doc.

6. code-scene

code-scene docs are an IR doc. The final artifact is [Slidev](https://sli.dev) slides.

Explanation => code-scene => slidev

Why do we need this IR?
- the IR does not contain any style information

---

Notes:

- reusability of elements between scences is important to create visual consistency
- having a "highlight" state of elements would be useful. perhaps define it once.