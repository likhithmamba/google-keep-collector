import { User } from 'firebase/auth';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface SignInButtonProps {
  user: User | null;
  isLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function SignInButton({ user, isLoading, onSignIn, onSignOut }: SignInButtonProps) {
  if (user) {
    return (
      <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-xs">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-7 h-7 rounded-full object-cover referrer-policy='no-referrer'"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
            <UserIcon className="w-4 h-4" />
          </div>
        )}
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-slate-800 leading-none">
            {user.displayName || 'User'}
          </p>
          <p className="text-[10px] text-slate-500 leading-none mt-0.5">
            {user.email}
          </p>
        </div>
        <button
          onClick={onSignOut}
          title="Sign Out"
          className="p-1.5 hover:bg-slate-50 text-slate-500 hover:text-red-600 rounded-full transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onSignIn}
      disabled={isLoading}
      className="gsi-material-button flex items-center gap-2 border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-50 transition-colors shadow-xs text-sm font-medium text-slate-700 bg-white cursor-pointer disabled:opacity-50"
    >
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
      </svg>
      <span>{isLoading ? 'Connecting...' : 'Sign in with Google'}</span>
    </button>
  );
}
