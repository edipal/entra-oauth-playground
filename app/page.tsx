import Link from 'next/link';

export default function RootPage() {
  return (
    <main className="container">
      <h1>Welcome</h1>
      <p>This site will auto-detect your language and redirect to the appropriate locale.</p>
      <p>If you need to, pick a language manually:</p>
      <ul>
        <li>
          <Link href="/en">English</Link>
        </li>
        <li>
          <Link href="/de">Deutsch</Link>
        </li>
      </ul>
    </main>
  );
}
