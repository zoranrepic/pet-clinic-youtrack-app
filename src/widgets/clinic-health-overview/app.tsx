import React, {memo, useCallback, useEffect, useMemo, useState} from 'react';
import Select, {Type as SelectType} from '@jetbrains/ring-ui-built/components/select/select';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';

import type {EmbeddableWidgetAPI} from '../../../@types/globals';

type Metric = 'good' | 'needsAttention' | 'doctorReview' | 'overdueVisits' | 'overdueVaccinations';

interface Overview {
  total: number;
  totals: Record<Metric, number>;
  groupBy: 'petType' | 'doctor';
  groups: {name: string, counts: Record<Metric, number>}[];
  filters: {
    canFilter: boolean;
    petType: string | null;
    doctor: string | null;
    petTypes: string[];
    doctors: {login: string, name: string}[];
  };
}

interface Option {
  key: string;
  label: string;
}

const CHARTS: {metric: Metric, title: string, tone: string}[] = [
  {metric: 'good', title: 'Good', tone: 'success'},
  {metric: 'needsAttention', title: 'Need attention', tone: 'warning'},
  {metric: 'doctorReview', title: 'Need doctor review', tone: 'error'},
  {metric: 'overdueVisits', title: 'Overdue visits', tone: 'accent'},
  {metric: 'overdueVaccinations', title: 'Overdue vaccinations', tone: 'accent'}
];

const PERCENT = 100;

const ALL_TYPES: Option = {key: '', label: 'All pet types'};
const ALL_DOCTORS: Option = {key: '', label: 'All doctors'};

const host = await YTApp.register() as EmbeddableWidgetAPI;

const Chart = ({title, tone, total, rows}: {title: string, tone: string, total: number, rows: {name: string, value: number}[]}) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="chart" aria-label={title}>
      <div className="chart__head">
        <span className="chart__title">{title}</span>
        <span className="chart__total">{total}</span>
      </div>
      <ul className="chart__bars">
        {rows.map((row) => (
          <li key={row.name} className="chart__row">
            <span className="chart__label" title={row.name}>{row.name}</span>
            <span className="chart__track">
              <span className={`chart__bar chart__bar_${tone}`} style={{width: `${(row.value / max) * PERCENT}%`}}/>
            </span>
            <span className="chart__value">{row.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

const AppComponent: React.FunctionComponent = () => {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [failed, setFailed] = useState(false);
  const [petType, setPetType] = useState<Option>(ALL_TYPES);
  const [doctor, setDoctor] = useState<Option>(ALL_DOCTORS);

  const load = useCallback(async (type: string, doctorLogin: string) => {
    await host.setLoadingAnimationEnabled(true);
    try {
      const query: Record<string, string> = {};
      if (type) {
        query.petType = type;
      }
      if (doctorLogin) {
        query.doctor = doctorLogin;
      }
      setOverview(await host.fetchApp<Overview>('clinic-dashboard-api/overview', {query}));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      await host.setLoadingAnimationEnabled(false);
    }
  }, []);

  useEffect(() => {
    load(petType.key, doctor.key);
  }, [load, petType, doctor]);

  const typeOptions = useMemo<Option[]>(() => [ALL_TYPES,
    ...(overview?.filters.petTypes ?? []).map((t) => ({key: t, label: t}))], [overview]);
  const doctorOptions = useMemo<Option[]>(() => [ALL_DOCTORS,
    ...(overview?.filters.doctors ?? []).map((d) => ({key: d.login, label: d.name}))], [overview]);

  if (failed && !overview) {
    return <div className="overview overview_error">{'Could not load the clinic overview. Try reloading the dashboard.'}</div>;
  }
  if (!overview) {
    return <div className="overview"><LoaderInline/></div>;
  }

  const byLabel = overview.groupBy === 'doctor' ? 'by doctor' : 'by pet type';

  return (
    <div className="overview">
      <div className="overview__bar">
        <span className="overview__muted">{`${overview.total} pets · charts ${byLabel}`}</span>
        {overview.filters.canFilter && (
          <div className="overview__filters">
            <Select
              type={SelectType.BUTTON}
              data={typeOptions}
              selected={petType}
              onChange={(item: Option | null) => setPetType(item ?? ALL_TYPES)}
              label="Pet type"
            />
            <Select
              type={SelectType.BUTTON}
              data={doctorOptions}
              selected={doctor}
              filter
              onChange={(item: Option | null) => setDoctor(item ?? ALL_DOCTORS)}
              label="Responsible doctor"
            />
          </div>
        )}
      </div>
      {failed && <div className="overview_error">{'Could not refresh the charts. Showing the last loaded data.'}</div>}
      <div className="overview__charts">
        {CHARTS.map((chart) => (
          <Chart
            key={chart.metric}
            title={chart.title}
            tone={chart.tone}
            total={overview.totals[chart.metric]}
            rows={overview.groups.map((g) => ({name: g.name, value: g.counts[chart.metric]}))}
          />
        ))}
      </div>
    </div>
  );
};

export const App = memo(AppComponent);
