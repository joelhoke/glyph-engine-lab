# Work media sources

Provenance for self-hosted images in `public/assets/work/` used by the case-study pages. All assets were downloaded from the original publisher CDNs (never hotlinked), re-encoded to strip metadata, and sized to a 1600px longest edge. Local copies were converted PNG → WebP (quality 85) in the 2026-09 performance pass; the original asset URLs below still point at the publisher's PNGs.

## EmployeeExperience-VivaConnections-Dashboard.webp

- **Story:** Employee Experience
- **Local path:** `public/assets/work/EmployeeExperience-VivaConnections-Dashboard.webp`
- **Source page:** https://www.microsoft.com/insidetrack/blog/deploying-microsoft-viva-connections-internally-at-microsoft/
- **Original asset URL:** https://www.microsoft.com/insidetrack/blog/uploads/prod/2023/06/10442_image001.png
- **Retrieval date:** 2026-08-15
- **Caption:** Microsoft's internal Viva Connections dashboard as published by Microsoft Inside Track — cards for pay, stock awards, facilities requests, tech support, and workplace services this design work supported.

## EmployeeExperience-VivaConnections.jpg

- **Story:** Employee Experience
- **Local path:** `public/assets/work/EmployeeExperience-VivaConnections.jpg`
- **Source page:** https://www.microsoft.com/en-us/microsoft-viva/connections
- **Original asset URL:** https://cdn-dynmedia-1.microsoft.com/is/image/microsoftcorp/271433-hero-image?resMode=sharp2&op_usm=1.5,0.65,15,0&wid=2000&hei=1125&qlt=100&fit=constrain
- **Retrieval date:** 2026-08-13
- **Caption:** Microsoft's published Viva Connections dashboard in Teams — the current public product surface that grew out of the employee-experience platform this design work contributed to.

## GlobalCompensation-TotalRewards-Employee.webp

- **Story:** Global Compensation
- **Local path:** `public/assets/work/GlobalCompensation-TotalRewards-Employee.webp`
- **Source page:** https://www.microsoft.com/insidetrack/blog/helping-microsoft-employees-understand-their-value-with-the-total-rewards-portal/
- **Original asset URL:** https://www.microsoft.com/insidetrack/blog/uploads/prod/2025/05/10752_Inside_Track_Total_Rewards_blog_employee_view_graphic.png
- **Retrieval date:** 2026-08-13
- **Caption:** The employee view of Microsoft's Total Rewards portal as published by Microsoft Inside Track — a public product view reflecting the compensation platform this design work contributed to.

## GlobalCompensation-TotalRewards-Manager.webp

- **Story:** Global Compensation
- **Local path:** `public/assets/work/GlobalCompensation-TotalRewards-Manager.webp`
- **Source page:** https://www.microsoft.com/insidetrack/blog/helping-microsoft-employees-understand-their-value-with-the-total-rewards-portal/
- **Original asset URL:** https://www.microsoft.com/insidetrack/blog/uploads/prod/2025/05/10752_Inside_Track_Total_Rewards_blog_manager_view_graphic2.png
- **Retrieval date:** 2026-08-13
- **Caption:** The manager team-dashboard view of Microsoft's Total Rewards portal as published by Microsoft Inside Track — a public product view reflecting the compensation platform this design work contributed to.

## digie-award/ (viewer) + digie-award-poster.webp

- **Story:** Global Operations
- **Local paths:** `public/assets/work/digie-award/` (self-hosted three.js viewer build: `embed.html`, `assets/`, `IBCon.png`) and `public/assets/work/digie-award-poster.webp` (1600×900 WebP, q85, metadata-stripped)
- **Provenance:** own work — the 2026 Digie Award modeled procedurally in three.js in the separate `crystal-award` workspace (`src/embed.js`), built with `npx vite build --base=/assets/work/digie-award/` and copied here. The viewer supports autonomous fullscreen motion, an inline `?inline=1` framing used by the live Outcome embed, a `?static=1` reduced-motion frame, and an optional parent-driven `?scroll=1` mode (unused today); the poster is a headless-Chrome capture of the static three-quarter pose. The IBCon logo texture (`IBCon.png`) ships with the viewer and is the award's physical etching.
- **Retrieval date:** 2026-09-08
- **Caption:** The 2026 Digie Award, modeled in three.js — the physical award Microsoft received for "Most Intelligent Corporate Campus" at RealComm IBcon 2026.

## RealComm-Highlights.mp4 (+ -h264.mp4, -poster.jpg)

- **Story:** Global Operations
- **Local paths:** `public/assets/work/RealComm-Highlights.mp4` (HEVC primary, hvc1-tagged), `public/assets/work/RealComm-Highlights-h264.mp4` (H.264 fallback), `public/assets/work/RealComm-Highlights-poster.jpg` (1600px frame capture at t=35s — the Live Campus Agent / Aura slide)
- **Provenance:** own footage — highlight reel of Microsoft's RealComm 2026 keynote, supplied by the author (`~/Downloads/RealcommHighlights.mp4`, 1920×1080 H.264/AAC, 65.9s); re-encoded (metadata-stripped, faststart) for web delivery. Replaces the earlier `RealComm-Keynote*` excerpt set.
- **Retrieval date:** 2026-09-08
- **Caption:** Highlights from Microsoft's RealComm 2026 keynote presentation, which the author supported with slide content and strategic story — the work that led to Microsoft winning the 2026 Digie award for "Most Intelligent Corporate Headquarters".
