import { redirect } from 'next/navigation';

/** The demo opens on the plan. */
export default function DemoPage() {
  redirect('/demo/plan');
}
