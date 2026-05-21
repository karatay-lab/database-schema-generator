export type UserRow = {
  id: number;
  email: string;
  name: string;
  bio: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
};

export const users: UserRow[] = [
  { id: 1,  email: "alice@example.com",   name: "Alice Chen",       bio: "Full-stack engineer passionate about clean code.",           role: "AUTHOR", createdAt: "2024-01-05T08:00:00Z", updatedAt: "2024-01-05T08:00:00Z" },
  { id: 2,  email: "bob@example.com",     name: "Bob Martinez",     bio: "Backend developer focused on distributed systems.",          role: "AUTHOR", createdAt: "2024-01-08T09:30:00Z", updatedAt: "2024-01-08T09:30:00Z" },
  { id: 3,  email: "carol@example.com",   name: "Carol White",      bio: "UI/UX designer who loves CSS and design systems.",           role: "AUTHOR", createdAt: "2024-01-10T10:00:00Z", updatedAt: "2024-01-10T10:00:00Z" },
  { id: 4,  email: "dan@example.com",     name: "Dan Kim",          bio: "DevOps engineer obsessed with automation and reliability.",  role: "AUTHOR", createdAt: "2024-01-12T11:15:00Z", updatedAt: "2024-01-12T11:15:00Z" },
  { id: 5,  email: "eva@example.com",     name: "Eva Rossi",        bio: null,                                                         role: "AUTHOR", createdAt: "2024-01-15T07:45:00Z", updatedAt: "2024-01-15T07:45:00Z" },
  { id: 6,  email: "frank@example.com",   name: "Frank Osei",       bio: "Data engineer building pipelines at scale.",                 role: "AUTHOR", createdAt: "2024-01-18T13:00:00Z", updatedAt: "2024-01-18T13:00:00Z" },
  { id: 7,  email: "grace@example.com",   name: "Grace Huang",      bio: "Mobile developer specialising in React Native.",             role: "AUTHOR", createdAt: "2024-01-20T14:30:00Z", updatedAt: "2024-01-20T14:30:00Z" },
  { id: 8,  email: "henry@example.com",   name: "Henry Patel",      bio: null,                                                         role: "READER", createdAt: "2024-01-22T09:00:00Z", updatedAt: "2024-01-22T09:00:00Z" },
  { id: 9,  email: "iris@example.com",    name: "Iris Novak",       bio: "Tech writer covering open-source tools and practices.",      role: "EDITOR", createdAt: "2024-01-25T10:30:00Z", updatedAt: "2024-01-25T10:30:00Z" },
  { id: 10, email: "james@example.com",   name: "James Liu",        bio: null,                                                         role: "READER", createdAt: "2024-01-28T08:15:00Z", updatedAt: "2024-01-28T08:15:00Z" },
  { id: 11, email: "kate@example.com",    name: "Kate Murphy",      bio: "Security researcher and CTF enthusiast.",                    role: "AUTHOR", createdAt: "2024-02-01T11:00:00Z", updatedAt: "2024-02-01T11:00:00Z" },
  { id: 12, email: "liam@example.com",    name: "Liam Torres",      bio: null,                                                         role: "READER", createdAt: "2024-02-03T12:30:00Z", updatedAt: "2024-02-03T12:30:00Z" },
  { id: 13, email: "mia@example.com",     name: "Mia Johnson",      bio: "Platform engineer building internal developer tools.",       role: "AUTHOR", createdAt: "2024-02-05T09:45:00Z", updatedAt: "2024-02-05T09:45:00Z" },
  { id: 14, email: "noah@example.com",    name: "Noah Bergman",     bio: null,                                                         role: "READER", createdAt: "2024-02-08T14:00:00Z", updatedAt: "2024-02-08T14:00:00Z" },
  { id: 15, email: "olivia@example.com",  name: "Olivia Yamamoto",  bio: "Frontend developer with a focus on performance and a11y.",   role: "AUTHOR", createdAt: "2024-02-10T10:15:00Z", updatedAt: "2024-02-10T10:15:00Z" },
  { id: 16, email: "peter@example.com",   name: "Peter Walsh",      bio: null,                                                         role: "READER", createdAt: "2024-02-12T08:30:00Z", updatedAt: "2024-02-12T08:30:00Z" },
  { id: 17, email: "quinn@example.com",   name: "Quinn Adeyemi",    bio: "Engineering manager turned technical blogger.",              role: "AUTHOR", createdAt: "2024-02-15T13:45:00Z", updatedAt: "2024-02-15T13:45:00Z" },
  { id: 18, email: "rachel@example.com",  name: "Rachel Svensson",  bio: null,                                                         role: "READER", createdAt: "2024-02-18T09:00:00Z", updatedAt: "2024-02-18T09:00:00Z" },
  { id: 19, email: "sam@example.com",     name: "Sam Kowalski",     bio: "Cloud architect and open-source contributor.",               role: "AUTHOR", createdAt: "2024-02-20T11:30:00Z", updatedAt: "2024-02-20T11:30:00Z" },
  { id: 20, email: "admin@example.com",   name: "Admin User",       bio: "Platform administrator.",                                    role: "ADMIN",  createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
];
