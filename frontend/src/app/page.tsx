import { redirect } from 'next/navigation';

// The app's home is the Today view; signed-out visitors are sent on to /auth.
export default function Home() {
  redirect('/today');
}
