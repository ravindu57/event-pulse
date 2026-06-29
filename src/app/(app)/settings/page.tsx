'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

type NotifPref = {
  analysis_complete: boolean;
  needs_attention: boolean;
  milestone_due: boolean;
  daily_reminder: boolean;
  streak_broken: boolean;
};

export default function SettingsPage() {
  const [profile] = useState({
    name: 'Event Coordinator',
    email: 'coordinator@eventpulse.app',
    role: 'coordinator' as const,
  });

  const [notifPrefs, setNotifPrefs] = useState<NotifPref>({
    analysis_complete: true,
    needs_attention: true,
    milestone_due: true,
    daily_reminder: true,
    streak_broken: false,
  });

  const [saved, setSaved] = useState(false);

  const togglePref = (key: keyof NotifPref) => {
    setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = () => {
    // In production, this would persist to Supabase
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const notifItems: { key: keyof NotifPref; title: string; desc: string; icon: string }[] = [
    { key: 'analysis_complete', title: 'Analysis Complete', desc: 'Notified when AI finishes analyzing a submission', icon: 'auto_awesome' },
    { key: 'needs_attention', title: 'Attention Required', desc: 'Urgent notifications when a submission is flagged by AI', icon: 'warning' },
    { key: 'milestone_due', title: 'Milestone Approaching', desc: '3-day warning before milestone deadlines', icon: 'flag' },
    { key: 'daily_reminder', title: 'Daily Reminder', desc: 'Email reminder at 9 PM if no submission today', icon: 'schedule' },
    { key: 'streak_broken', title: 'Streak Broken', desc: 'Alert when a committee\'s submission streak is broken', icon: 'local_fire_department' },
  ];

  return (
    <div className="p-4 md:p-margin-desktop w-full max-w-[900px] mx-auto flex flex-col gap-8 animate-fade-in pb-16">
      {/* Header */}
      <div>
        <h2 className="font-geist text-display-lg-mobile md:text-[40px] font-bold text-on-surface mb-2 leading-tight">Settings</h2>
        <p className="text-body-lg text-secondary">Manage your profile and notification preferences.</p>
      </div>

      {/* Profile Section */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-lowest">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined fill-icon text-primary">person</span>
            Profile
          </h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary border-2 border-primary/20">
              <span className="font-geist text-[24px] font-bold">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <p className="font-geist text-headline-sm text-on-surface font-semibold">{profile.name}</p>
              <p className="text-body-sm text-secondary mt-0.5">{profile.email}</p>
              <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-primary/10 text-primary text-label-sm font-semibold rounded-full capitalize">
                {profile.role}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label-md font-semibold text-on-surface">Full Name</label>
              <input
                type="text"
                defaultValue={profile.name}
                className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-body-md text-on-surface outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-label-md font-semibold text-on-surface">Email</label>
              <input
                type="email"
                defaultValue={profile.email}
                disabled
                className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant rounded-xl text-body-md text-secondary outline-none cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-lowest">
          <h3 className="font-geist text-headline-sm text-on-surface font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined fill-icon text-primary">notifications</span>
            Email Notifications
          </h3>
          <p className="text-body-sm text-secondary mt-1">Choose which events trigger an email notification.</p>
        </div>
        <div className="divide-y divide-outline-variant">
          {notifItems.map(item => (
            <div key={item.key} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-lowest transition-colors">
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  item.key === 'needs_attention' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                )}>
                  <span className="material-symbols-outlined fill-icon text-[20px]">{item.icon}</span>
                </div>
                <div>
                  <p className="text-label-md font-semibold text-on-surface">{item.title}</p>
                  <p className="text-body-sm text-secondary mt-0.5">{item.desc}</p>
                </div>
              </div>
              <button
                onClick={() => togglePref(item.key)}
                className={cn(
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                  notifPrefs[item.key] ? 'bg-primary' : 'bg-surface-container-highest'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    notifPrefs[item.key] ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-tertiary text-label-md flex items-center gap-1 animate-fade-in">
            <span className="material-symbols-outlined fill-icon text-[16px]">check_circle</span>
            Settings saved
          </span>
        )}
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-label-md font-medium hover:opacity-90 transition-opacity shadow-sm btn-tactile flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          Save Changes
        </button>
      </div>
    </div>
  );
}
