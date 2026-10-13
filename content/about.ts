/** Personal desktop: order also determines keyboard order and the comic preview. */
export const ABOUT = {
  title: 'Outside the day job.',
  intro: 'A few of my favorite things. Take a look around.',
  interests: [
    { id: 'family', title: 'Family', label: 'My favorite people', description: 'My family is my biggest motivation—the reason I wake up ready to do what I do each day.', placeholder: 'A space for family moments and favorite memories.' },
    { id: 'comics', title: 'Creative Media', label: 'Watching, reading & playing', description: 'What I’m watching, reading, and playing.', placeholder: '',
    },
    { id: 'smart-home', title: 'Smart home', label: 'Connected things', description: 'The smart home enthusiast in me.', placeholder: 'Setups, automations, and experiments will live here.' },
    { id: 'options', title: 'Personal finance', label: 'Following possibilities', description: 'Another one of my interests outside design.', placeholder: 'A space for my approach to personal finance. More to come.' },
    { id: 'automotive', title: 'Car Culture', label: 'Race weekends & garage projects', description: 'From Formula 1 weekends to DIY work on my 4Runner.', placeholder: '',
      sections: [
        { title: 'Formula 1', description: 'For the F1 fan in me.', placeholder: 'Favorite teams, races, and moments will live here.' },
        { title: 'DIY 4Runner', description: 'The projects don’t stop at the screen.', placeholder: 'Modifications, garage notes, and the build so far will live here.' },
      ],
    },
  ],
} as const
export type InterestId = typeof ABOUT.interests[number]['id']
export type Interest = typeof ABOUT.interests[number]

/** Add each new family cutout here; the carousel and its accessible fallback share this list. */
export const FAMILY_STICKERS = [{ src: "/assets/about/family.webp", alt: "Joel with his family" }] as const

/** Personal stories shared by the vehicle hotspots and their detail panels. */
export const CAR_STORIES = [
  { id: 'lighting', label: '2007 Toyota 4Runner', title: 'My personal project since 2020',
    photo: { src: '/assets/about/photos/4runner-1200.webp', srcSet: '/assets/about/photos/4runner-600.webp 600w, /assets/about/photos/4runner-1200.webp 1200w', width: 1200, height: 1600, alt: 'My black Toyota 4Runner on a forest road overlooking the mountains at sunset.' },
    body: 'When funding allows, I love modifying my Toyota 4Runner for camping and overlanding. She’s been an incredible part of the family, giving us a chance to really explore Washington’s great outdoors.' },
  { id: 'mclaren', label: 'Formula 1', title: 'I’ve got a drive, to survive',
    photo: { src: '/assets/about/photos/f1-1200.webp', srcSet: '/assets/about/photos/f1-600.webp 600w, /assets/about/photos/f1-1200.webp 1200w', width: 1200, height: 675, alt: 'A red Ferrari Formula 1 car cornering on a racetrack.' },
    body: 'I’ve always loved cars and motorsport, but I must admit I’m a full convert to Formula 1 since we binged Drive to Survive on Netflix during COVID. Now I love following along every race weekend.' },
] as const
export type CarStoryId = typeof CAR_STORIES[number]['id']
