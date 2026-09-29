import React, {memo, useCallback, useEffect, useState} from 'react';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Tooltip from '@jetbrains/ring-ui-built/components/tooltip/tooltip';

import {PetFace, type Mood, type Species} from './pet-face';

type Level = 'good' | 'attention' | 'review';

interface Condition {
  level: Level;
  tag: string;
  reasons: string[];
  species: string | null;
}

const VIEW: Record<Level, {mood: Mood, title: string}> = {
  good: {mood: 'happy', title: 'Good'},
  attention: {mood: 'neutral', title: 'Needs attention'},
  review: {mood: 'sad', title: 'Doctor review needed'}
};

const capitalize = (text: string) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

let refreshListener: (() => void) | null = null;

// Register once at module scope. YouTrack calls onRefresh when the issue is updated.
const host = await YTApp.register({
  onRefresh: () => refreshListener?.()
});

const AppComponent: React.FunctionComponent = () => {
  const [condition, setCondition] = useState<Condition | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await host.fetchApp<Condition>('pet-condition/condition', {scope: true});
      setCondition(result);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    refreshListener = load;
    return () => {
      refreshListener = null;
    };
  }, [load]);

  if (failed) {
    return <div className="condition condition_error">{'Could not load the pet condition.'}</div>;
  }
  if (!condition) {
    return <div className="condition"><LoaderInline/></div>;
  }

  const view = VIEW[condition.level] ?? VIEW.attention;
  const species: Species = condition.species === 'Cat' ? 'cat' : 'dog';
  // Healthy pets get one combined sentence; otherwise show the main reason and list the rest in a tooltip.
  const [main, ...more] = condition.level === 'good' ? [condition.reasons.join(', ')] : condition.reasons;

  return (
    <div className="condition">
      <PetFace species={species} mood={view.mood}/>
      <div className="condition__text">
        <div className="condition__label">{'Overall condition'}</div>
        <div className={`condition__status condition__status_${condition.level}`}>{view.title}</div>
        <div className="condition__reason">
          {capitalize(main)}
          {more.length > 0 && (
            <Tooltip title={condition.reasons.map(capitalize).join('\n')}>
              <span className="condition__more">{` +${more.length} more`}</span>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};

export const App = memo(AppComponent);
