import React, {memo, useEffect, useState} from 'react';
import Heading from '@jetbrains/ring-ui-built/components/heading/heading';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';

interface Pet {
  id: string;
  name: string;
  url: string;
}

type Category = 'healthy' | 'needsAttention' | 'doctorReview' | 'overdueVisits' | 'overdueVaccinations';

interface Summary {
  doctor: {login: string, name: string};
  total: number;
  isOwnProfile: boolean;
  counts: Record<Category, number>;
  pets: Record<Category, Pet[]>;
}

const TILES: {key: Category, label: string, tone: 'success' | 'warning' | 'error' | 'neutral'}[] = [
  {key: 'healthy', label: 'Healthy', tone: 'success'},
  {key: 'needsAttention', label: 'Need attention', tone: 'warning'},
  {key: 'doctorReview', label: 'Need doctor review', tone: 'error'},
  {key: 'overdueVisits', label: 'Overdue visits', tone: 'neutral'},
  {key: 'overdueVaccinations', label: 'Overdue vaccinations', tone: 'neutral'}
];

// Lists shown under the tiles: the categories a doctor has to act on.
const ACTION_LISTS: Category[] = ['doctorReview', 'overdueVisits', 'overdueVaccinations', 'needsAttention'];

const FORBIDDEN = 403;

const host = await YTApp.register();

const PetLinks = ({pets}: {pets: Pet[]}) => (
  <span>
    {pets.map((pet, index) => (
      <React.Fragment key={pet.id}>
        {index > 0 && ', '}
        <Link href={pet.url} target="_blank">{pet.id}</Link>
        {` ${pet.name}`}
      </React.Fragment>
    ))}
  </span>
);

const AppComponent: React.FunctionComponent = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<'forbidden' | 'failed' | null>(null);

  useEffect(() => {
    host.fetchApp<Summary>('doctor-summary-api/summary', {scope: true}).
      then(setSummary).
      catch((e: {status?: number, data?: {error?: string}}) => {
        setError(e?.status === FORBIDDEN || e?.data?.error ? 'forbidden' : 'failed');
      });
  }, []);

  if (error === 'forbidden') {
    return (
      <div className="summary">
        <Heading level={3}>{'My pet summary'}</Heading>
        <p className="summary__muted">{'This summary is available only to members of the Doctors group.'}</p>
      </div>
    );
  }
  if (error === 'failed') {
    return <div className="summary summary__error">{'Could not load the pet summary. Try reloading the page.'}</div>;
  }
  if (!summary) {
    return <div className="summary"><LoaderInline/></div>;
  }

  const owner = summary.isOwnProfile ? 'you are' : `${summary.doctor.name} is`;
  const lists = ACTION_LISTS.filter((key) => summary.pets[key].length > 0);

  return (
    <div className="summary">
      <Heading level={3}>{'My pet summary'}</Heading>
      <p className="summary__muted">
        {summary.total === 1 ? `1 pet where ${owner} the responsible doctor` :
          `${summary.total} pets where ${owner} the responsible doctor`}
      </p>

      <div className="summary__tiles">
        {TILES.map((tile) => (
          <div key={tile.key} className={`summary__tile summary__tile_${tile.tone}`}>
            <div className="summary__count">{summary.counts[tile.key]}</div>
            <div className="summary__label">{tile.label}</div>
          </div>
        ))}
      </div>

      {lists.length > 0 && (
        <dl className="summary__lists">
          {lists.map((key) => (
            <div key={key} className="summary__list">
              <dt className="summary__list-title">{TILES.find((t) => t.key === key)?.label}</dt>
              <dd className="summary__list-pets"><PetLinks pets={summary.pets[key]}/></dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};

export const App = memo(AppComponent);
