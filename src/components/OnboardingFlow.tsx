import { ArrowRight, Check, LockKeyhole, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

interface OnboardingFlowProps {
  initialName: string;
  onComplete: () => void;
}

const AVATARS = ['🌑', '🟢', '🐧', '🧿', '🟣', '🥷', '🌕', '🟩', '🦝', '🌊', '🌸', '😎'];
const MOVIE_GENRES = ['كوميديا', 'أكشن', 'دراما', 'رعب', 'رومانسية', 'مغامرة', 'خيال علمي', 'إثارة', 'رسوم متحركة', 'جريمة', 'فانتازيا', 'غموض', 'وثائقي', 'عائلي', 'تاريخ', 'موسيقى', 'حرب', 'غربي'];
const TV_GENRES = ['كوميديا', 'دراما', 'أكشن ومغامرة', 'جريمة', 'خيال علمي وفانتازيا', 'غموض', 'رسوم متحركة', 'عائلي', 'وثائقي', 'أطفال', 'حرب وسياسة', 'غربي'];

export default function OnboardingFlow({ initialName, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName || 'مستخدم نوار');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [pin, setPin] = useState('');
  const [movieGenres, setMovieGenres] = useState<string[]>([]);
  const [tvGenres, setTvGenres] = useState<string[]>([]);
  const progress = useMemo(() => Array.from({ length: 5 }, (_, index) => index), []);

  const finish = () => {
    localStorage.setItem('noir_profile_name', name.trim() || initialName);
    localStorage.setItem('noir_profile_avatar', avatar);
    localStorage.setItem('noir_profile_pin', pin);
    localStorage.setItem('noir_movie_genres', JSON.stringify(movieGenres));
    localStorage.setItem('noir_tv_genres', JSON.stringify(tvGenres));
    onComplete();
  };

  const toggleGenre = (genre: string, values: string[], setter: (next: string[]) => void) => {
    if (values.includes(genre)) setter(values.filter((item) => item !== genre));
    else if (values.length < 3) setter([...values, genre]);
  };

  return (
    <main className="noir-onboarding" dir="rtl">
      {step < 5 && (
        <div className="noir-onboarding-progress" aria-label={`الخطوة ${step + 1} من 5`}>
          {progress.map((dot) => <i key={dot} className={dot === step ? 'is-active' : dot < step ? 'is-done' : ''} />)}
        </div>
      )}

      {step === 0 && (
        <section className="noir-setup-panel">
          <h1>أنشئ ملفك الشخصي</h1>
          <p>اختر اسماً يظهر لمن يشاهد الآن.</p>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم الملف الشخصي" autoFocus />
          <button className="noir-setup-primary" disabled={!name.trim()} onClick={() => setStep(1)}>متابعة</button>
        </section>
      )}

      {step === 1 && (
        <section className="noir-setup-panel noir-avatar-step">
          <span className="noir-profile-chip">{avatar} {name}</span>
          <h1>اختر مظهرك</h1>
          <p>اختر صورة تعبّر عن هذا الملف.</p>
          <div className="noir-avatar-grid">
            {AVATARS.map((value) => (
              <button key={value} onClick={() => setAvatar(value)} className={avatar === value ? 'is-selected' : ''} aria-label={`اختيار ${value}`}>
                <span>{value}</span>{avatar === value && <Check />}
              </button>
            ))}
          </div>
          <div className="noir-setup-actions"><button onClick={() => setStep(0)}><ArrowRight /> رجوع</button><button className="noir-setup-primary" onClick={() => setStep(2)}>متابعة</button></div>
        </section>
      )}

      {step === 2 && (
        <section className="noir-setup-panel">
          <span className="noir-profile-chip">{avatar} {name}</span>
          <LockKeyhole className="noir-setup-icon" />
          <h1>هل تريد قفل الملف برمز PIN؟</h1>
          <p>أدخل أربعة أرقام أو اتركه فارغاً لتخطي الخطوة.</p>
          <input className="noir-pin-input" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="— — — —" />
          <div className="noir-setup-actions"><button onClick={() => setStep(1)}><ArrowRight /> رجوع</button><button className="noir-setup-primary" disabled={pin.length > 0 && pin.length < 4} onClick={() => setStep(3)}>متابعة</button></div>
        </section>
      )}

      {step === 3 && (
        <GenreStep title="شنو الأفلام اللي تحبها؟" subtitle="اختر إلى ثلاثة تصنيفات حتى نجهز اقتراحاتك." genres={MOVIE_GENRES} selected={movieGenres} onToggle={(genre) => toggleGenre(genre, movieGenres, setMovieGenres)} onBack={() => setStep(2)} onContinue={() => setStep(4)} />
      )}

      {step === 4 && (
        <GenreStep title="شنو المسلسلات اللي تحبها؟" subtitle="اختر إلى ثلاثة تصنيفات للمسلسلات." genres={TV_GENRES} selected={tvGenres} onToggle={(genre) => toggleGenre(genre, tvGenres, setTvGenres)} onBack={() => setStep(3)} onContinue={() => setStep(5)} finalLabel="ابدأ المشاهدة" />
      )}

      {step === 5 && (
        <section className="noir-setup-panel noir-profile-picker">
          <h1>من يشاهد الآن؟</h1>
          <div className="noir-profile-choices">
            <button onClick={finish}><span>{avatar}</span><strong>{name}</strong></button>
            <button className="is-add"><span><Plus /></span><strong>إضافة ملف</strong></button>
          </div>
          <button className="noir-setup-secondary" onClick={() => setStep(0)}>إدارة الملفات</button>
        </section>
      )}
    </main>
  );
}

function GenreStep({ title, subtitle, genres, selected, onToggle, onBack, onContinue, finalLabel = 'متابعة' }: {
  title: string;
  subtitle: string;
  genres: string[];
  selected: string[];
  onToggle: (genre: string) => void;
  onBack: () => void;
  onContinue: () => void;
  finalLabel?: string;
}) {
  return (
    <section className="noir-setup-panel noir-genre-step">
      <h1>{title}</h1><p>{subtitle}</p>
      <div className="noir-genre-pills">
        {genres.map((genre) => <button key={genre} className={selected.includes(genre) ? 'is-selected' : ''} onClick={() => onToggle(genre)}>{genre}</button>)}
      </div>
      <div className="noir-setup-actions"><button onClick={onBack}><ArrowRight /> رجوع</button><button className="noir-setup-primary" onClick={onContinue}>{finalLabel}</button></div>
    </section>
  );
}
