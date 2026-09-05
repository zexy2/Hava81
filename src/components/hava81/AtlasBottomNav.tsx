import { useTranslation } from 'react-i18next';
import './AtlasBottomNav.css';

export type AtlasNavValue = 'today' | 'map' | 'saved';

export interface AtlasBottomNavProps {
  active: AtlasNavValue;
  onSelect: (value: AtlasNavValue) => void;
  hasSaved: boolean;
  canMap: boolean;
}

function TodayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m3.5 6 5-2.5 7 2.5 5-2.5v14.5l-5 2.5-7-2.5-5 2.5z" />
      <path d="M8.5 3.5v14.5M15.5 6v14.5" />
    </svg>
  );
}

function SavedIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.5 4.5h11v15l-5.5-3-5.5 3z" />
    </svg>
  );
}

export function AtlasBottomNav({ active, onSelect, hasSaved, canMap }: AtlasBottomNavProps) {
  const { t } = useTranslation();

  const items: Array<{
    value: AtlasNavValue;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      value: 'today',
      label: t('navigation.today', { defaultValue: t('days.today') }),
      icon: <TodayIcon />,
    },
    {
      value: 'map',
      label: t('navigation.map', { defaultValue: t('common.map') }),
      icon: <MapIcon />,
    },
    {
      value: 'saved',
      label: t('navigation.saved', { defaultValue: t('weather.favoriteCities') }),
      icon: <SavedIcon />,
    },
  ];

  return (
    <nav
      className="atlas-bottom-nav"
      aria-label={t('navigation.label', { defaultValue: 'Hava81' })}
    >
      {items.map(item => {
        const isActive = active === item.value;
        const isDisabled = item.value === 'map' && !canMap;

        return (
          <button
            key={item.value}
            type="button"
            className={`atlas-bottom-nav__button${isActive ? ' atlas-bottom-nav__button--active' : ''}`}
            onClick={() => onSelect(item.value)}
            aria-current={isActive ? 'location' : undefined}
            disabled={isDisabled}
          >
            <span className="atlas-bottom-nav__icon">
              {item.icon}
              {item.value === 'saved' && hasSaved ? (
                <span className="atlas-bottom-nav__saved-mark" aria-hidden="true" />
              ) : null}
            </span>
            <span className="atlas-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default AtlasBottomNav;
