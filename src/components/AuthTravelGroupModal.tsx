import React, { useState } from 'react';
import { X, Users, User as UserIcon, Heart, Compass, Check, AlertCircle } from 'lucide-react';
import { Language, TravelGroupProfile, TravelGroupType, User } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface AuthTravelGroupModalProps {
  isOpen: boolean;
  initialStep?: 'auth' | 'group';
  language: Language;
  onLanguageChange: (lang: Language) => void;
  currentUser: User | null;
  onAuthSuccess: (user: User, token: string, needsGroupSetup: boolean) => void;
  onProfileSaved: (user: User) => void;
  onGuestGroupSaved: (group: TravelGroupProfile) => void;
  onClose: () => void;
}

export default function AuthTravelGroupModal({
  isOpen,
  initialStep = 'auth',
  language,
  onLanguageChange,
  currentUser,
  onAuthSuccess,
  onProfileSaved,
  onGuestGroupSaved,
  onClose,
}: AuthTravelGroupModalProps) {
  const t = TRANSLATIONS[language];
  const [step, setStep] = useState<'auth' | 'group'>(currentUser ? 'group' : initialStep);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [groupType, setGroupType] = useState<TravelGroupType>(
    currentUser?.travelGroup?.groupType || 'family'
  );
  const [memberCount, setMemberCount] = useState<number>(
    currentUser?.travelGroup?.memberCount || 4
  );
  const [hasChildren, setHasChildren] = useState<boolean>(
    currentUser?.travelGroup?.hasChildren || false
  );
  const [hasSeniors, setHasSeniors] = useState<boolean>(
    currentUser?.travelGroup?.hasSeniors || false
  );
  const [budgetTier, setBudgetTier] = useState<'budget' | 'moderate' | 'premium'>(
    currentUser?.travelGroup?.budgetTier || 'moderate'
  );
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(currentUser);

  if (!isOpen) return null;

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (authTab === 'signup') {
      if (name.trim().length < 2) {
        setError(language === 'ta' ? 'குறைந்தது 2 எழுத்துகள் கொண்ட பெயரை உள்ளிடவும்.' : 'Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setError(language === 'ta' ? 'கடவுச்சொற்கள் பொருந்தவில்லை.' : 'Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = authTab === 'signup' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          authTab === 'signup'
            ? { name, email, password, preferredLanguage: language }
            : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
        return;
      }

      setAuthToken(data.token);
      setPendingUser(data.user);
      const needsGroup = authTab === 'signup' || !data.user.travelGroup;
      onAuthSuccess(data.user, data.token, needsGroup);
      if (needsGroup) {
        setStep('group');
      } else {
        onClose();
      }
    } catch {
      setError('Network error. Please verify connection or continue as Guest.');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const profile: TravelGroupProfile = {
      groupType,
      memberCount: groupType === 'individual' ? 1 : groupType === 'couple' ? Math.max(2, memberCount) : Math.max(2, memberCount),
      hasChildren,
      hasSeniors,
      budgetTier,
    };

    const token = authToken || localStorage.getItem('lg_auth_token_v1');
    if (token && (pendingUser || currentUser)) {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ preferredLanguage: language, travelGroup: profile }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          onProfileSaved(data.user);
          onClose();
          return;
        }
      } catch {
        // fallback locally
      } finally {
        setLoading(false);
      }
    }

    onGuestGroupSaved(profile);
    onClose();
  };

  const groupOptions: Array<{
    id: TravelGroupType;
    label: string;
    desc: string;
    icon: React.ReactNode;
    defaultCount: number;
  }> = [
    {
      id: 'individual',
      label: t.groupIndividual,
      desc: t.groupIndividualDesc,
      icon: <UserIcon className="h-5 w-5" />,
      defaultCount: 1,
    },
    {
      id: 'family',
      label: t.groupFamily,
      desc: t.groupFamilyDesc,
      icon: <Users className="h-5 w-5" />,
      defaultCount: 4,
    },
    {
      id: 'couple',
      label: t.groupCouple,
      desc: t.groupCoupleDesc,
      icon: <Heart className="h-5 w-5" />,
      defaultCount: 2,
    },
    {
      id: 'friends',
      label: t.groupFriends,
      desc: t.groupFriendsDesc,
      icon: <Compass className="h-5 w-5" />,
      defaultCount: 5,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Top utility strip */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('ta')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                language === 'ta' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              தமிழ்
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'auth' ? (
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t.authWelcome}</h2>
            <p className="mt-1.5 text-sm text-slate-600">{t.authSubtitle}</p>

            <div className="mt-5 flex gap-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signup');
                  setError('');
                }}
                className={`border-b-2 pb-2.5 px-3 text-sm font-semibold transition-colors ${
                  authTab === 'signup'
                    ? 'border-blue-800 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.signupTab}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setError('');
                }}
                className={`border-b-2 pb-2.5 px-3 text-sm font-semibold transition-colors ${
                  authTab === 'login'
                    ? 'border-blue-800 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.loginTab}
              </button>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
              {authTab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700">{t.fullName}</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Karthik Subramanian"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">{t.emailLabel}</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="traveller@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <div className={authTab === 'signup' ? 'grid gap-4 sm:grid-cols-2' : ''}>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">{t.passwordLabel}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                  />
                </div>
                {authTab === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      {t.confirmPasswordLabel}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-60"
                >
                  {loading
                    ? '...'
                    : authTab === 'signup'
                      ? t.createAccountBtn
                      : t.signInBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('group')}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t.continueGuest}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={handleGroupSubmit} className="p-6 md:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t.travelGroupTitle}</h2>
            <p className="mt-1.5 text-sm text-slate-600">{t.travelGroupSubtitle}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {groupOptions.map((opt) => {
                const active = groupType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setGroupType(opt.id);
                      setMemberCount(opt.defaultCount);
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-blue-800 bg-blue-50/60 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`mt-0.5 rounded-lg p-2 ${
                        active ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{opt.label}</span>
                        {active && <Check className="h-4 w-4 text-blue-800" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">{t.memberCountLabel}</label>
                <input
                  type="number"
                  min={groupType === 'couple' ? 2 : 1}
                  max={30}
                  disabled={groupType === 'individual'}
                  value={groupType === 'individual' ? 1 : memberCount}
                  onChange={(e) => setMemberCount(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">{t.budgetTierLabel}</label>
                <select
                  value={budgetTier}
                  onChange={(e) => setBudgetTier(e.target.value as 'budget' | 'moderate' | 'premium')}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="budget">{t.budgetEconomic}</option>
                  <option value="moderate">{t.budgetModerate}</option>
                  <option value="premium">{t.budgetPremium}</option>
                </select>
              </div>

              {(groupType === 'family' || groupType === 'friends') && (
                <div className="flex flex-wrap gap-5 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={hasChildren}
                      onChange={(e) => setHasChildren(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-800"
                    />
                    {t.hasChildrenLabel}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={hasSeniors}
                      onChange={(e) => setHasSeniors(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-800"
                    />
                    {t.hasSeniorsLabel}
                  </label>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900"
              >
                {t.saveGroupBtn}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
