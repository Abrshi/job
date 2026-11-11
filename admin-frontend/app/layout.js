import './globals.css';
import { AdminAuthProvider } from '@/context/admin-auth-context';

export const metadata = {
  title: 'JobSphere Admin Console',
  description: 'Enterprise Administrative & Governance Portal for Job Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-sky-500 selection:text-slate-950">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}

