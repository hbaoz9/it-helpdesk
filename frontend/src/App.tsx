import { AuthProvider } from './shared/auth/AuthContext';
import AppRouter from './app/AppRouter';
import AppProviders from './app/AppProviders';

export default function App() {
  return <AppProviders><AuthProvider><AppRouter /></AuthProvider></AppProviders>;
}
