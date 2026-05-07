export interface Testimonial {
  name: string;
  role: string;
  text: string;
  photo: string;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah Johnson',
    role: 'Entrepreneur',
    photo: 'https://randomuser.me/api/portraits/women/44.jpg',
    text: 'Benny has a unique way of simplifying complex concepts. After I started listening, my perspective on business completely changed.',
  },
  {
    name: 'Michael Davis',
    role: 'Marketing Consultant',
    photo: 'https://randomuser.me/api/portraits/men/32.jpg',
    text: "Finally a podcast that doesn't waste time with fluff. Every episode is pure value. I recommend it to everyone who wants to grow.",
  },
  {
    name: 'Emily Carter',
    role: 'Hair Stylist',
    photo: 'https://randomuser.me/api/portraits/women/68.jpg',
    text: 'The mindset episode changed my life. By applying the concepts, I increased my revenue by 300% in 6 months.',
  },
  {
    name: 'James Wilson',
    role: 'Angel Investor',
    photo: 'https://randomuser.me/api/portraits/men/75.jpg',
    text: "I've listened to dozens of business podcasts. Beny is the only one who tells you what no one else will. The episode on raising capital saved me from a bad deal.",
  },
  {
    name: 'Jessica Thompson',
    role: 'Holistic Therapist',
    photo: 'https://randomuser.me/api/portraits/women/12.jpg',
    text: 'Every Friday I block 45 minutes for the new drop. The conversations on consciousness and personal growth are unlike anything else out there.',
  },
  {
    name: 'David Anderson',
    role: 'Tech Founder',
    photo: 'https://randomuser.me/api/portraits/men/52.jpg',
    text: "Started listening on a flight, didn't stop until I'd finished six episodes. The way Beny pushes guests to go deeper is rare. Required listening for any operator.",
  },
];
