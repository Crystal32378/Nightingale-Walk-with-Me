# How the first route was developed

Nightingale's first route connects MRT Zhongxiao Fuxing Exit 2 to the step-free lobby entrance of Taipei City Hospital, Renai Branch. Its route knowledge comes from field observation, human review and AI-assisted organization.

## Three field visits

On 2026-10-08, the route author reported three visits with distinct purposes: **scouting, annotation and verification**, each taking approximately **10–15 minutes**. This is the author's retrospective estimate of the field visits, not a promise of journey time for wheelchair users or older adults, and not the total cost of building a route. Reviewing images, resolving ambiguities, writing guidance, recording speech and testing software require additional work.

The historical [field notes](route-renai-field-notes.md) document the first two visits on 2026-09-26 and 2026-09-28. The third visit is recorded here from the author's 2026-10-08 report; its exact date is not established by this update. The historical notes and their original media timestamps remain unchanged.

## A reviewed set of 57 reference images

The second-visit review contains **57 human-reviewed images**: 12 still photographs and three frames from each of 15 videos. The review-sheet [generator](../scripts/make-trip2-review.py) records that composition; the completed [human review](../eval/reviews/trip2-2026-10-07/human-review.json) and [review report](photo-review-2026-10-08.md) preserve the annotations and corrections.

These are reference images for reconstructing and checking the path, including confusing entrances and recovery landmarks. The number 57 refers to this reviewed set. It is not the total number of original photographs across all three visits: the evaluation also retains a separate 42-image first-visit set. Original media remains outside the public repository.

## Human and AI roles

People observe the route, read signs, check physical access, correct interpretations and approve route facts. AI-assisted tooling helps organize the evidence and interpret images; human review can correct both wording and location labels. The resulting navigation graph remains human-authored and field-checked. At runtime, Gemini interprets user observations, while the deterministic validator and engine decide which guidance may be shown.

This process is the starting point for the proposed [family preparation and hospital-volunteer workflow](next-steps.md). Three visits and a reviewed image set provide route-development evidence. They do not establish completed end-to-end outdoor acceptance of the frozen English app, user outcome improvements, or a universal route-onboarding time.
