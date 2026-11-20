/** Public, site-native playgrounds shared by the gallery and homepage carousel. */
export const GALLERY_PLAYGROUNDS = [{
  id: 'three-gradient',
  title: 'Three.Gradient',
  collection: 'Interactive playgrounds',
  summary: 'Paint a morphing flower with color. Explore gradients and animate with time or your scroll.',
  href: '/gallery/three-gradient',
  thumbnail: '/assets/home/flower/plumeria.webp',
  requiresPassword: false,
}, ...[
  { id: 'neon-trip', title: 'Neon Trip', summary: 'Shape luminous color. Explore glowing forms, type, and animated light.' },
  { id: 'loonz', title: 'Loonz', summary: 'Draw an outline and release to inflate a foil balloon. Grab it and give it a toss.' },
  { id: 'darkwater', title: 'DarkWater', summary: 'Drop shapes into moving water and light them from different angles.' },
  { id: 'gradient-bands', title: 'Gradient Bands', summary: 'Draw your own ribbons of color and watch them drift across the canvas.' },
].map(project => ({
  ...project,
  collection: 'Interactive playgrounds',
  href: `/gallery/${project.id}`,
  thumbnail: `/assets/gallery/${project.id}.webp`,
  requiresPassword: false,
}))]
