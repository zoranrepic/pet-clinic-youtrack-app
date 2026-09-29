/* eslint-disable no-magic-numbers -- SVG drawing coordinates */
import React, {memo} from 'react';

export type Mood = 'happy' | 'neutral' | 'sad';
export type Species = 'dog' | 'cat';

const TINT: Record<Mood, string> = {
  happy: 'var(--ring-main-success-components)',
  neutral: 'var(--ring-main-warning-components)',
  sad: 'var(--ring-main-error-components)'
};

const INK = 'var(--ring-text-color)';
const PAPER = 'var(--ring-content-background-color)';

// Eyes: happy = closed smiling arcs, neutral = dots, sad = dots with worried brows.
const Eyes = ({y, mood}: {y: number, mood: Mood}) => {
  if (mood === 'happy') {
    return (
      <g fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round">
        <path d={`M21 ${y + 1} q3 -4 6 0`}/>
        <path d={`M37 ${y + 1} q3 -4 6 0`}/>
      </g>
    );
  }
  return (
    <g>
      <circle cx={24} cy={y} r={2.5} fill={INK}/>
      <circle cx={40} cy={y} r={2.5} fill={INK}/>
      {mood === 'sad' && (
        <g fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round">
          <path d={`M19 ${y - 4} L27 ${y - 7}`}/>
          <path d={`M45 ${y - 4} L37 ${y - 7}`}/>
        </g>
      )}
    </g>
  );
};

const Dog = ({mood}: {mood: Mood}) => {
  const tint = TINT[mood];
  return (
    <>
      {/* Ears sit behind the head, so they are drawn first and filled solid. */}
      {[{cx: 14, angle: 18}, {cx: 50, angle: -18}].map(({cx, angle}) => (
        <g key={cx} transform={`rotate(${angle} ${cx} 31)`}>
          <ellipse cx={cx} cy={31} rx={6} ry={11} fill={PAPER}/>
          <ellipse cx={cx} cy={31} rx={6} ry={11} fill={`rgba(${tint}, 0.45)`} stroke={INK} strokeWidth={2}/>
        </g>
      ))}
      <circle cx={32} cy={34} r={18} fill={PAPER}/>
      <circle cx={32} cy={34} r={18} fill={`rgba(${tint}, 0.18)`} stroke={INK} strokeWidth={2}/>
      <Eyes y={30} mood={mood}/>
      <ellipse cx={32} cy={41} rx={8} ry={6} fill={PAPER} stroke={INK} strokeWidth={1.5}/>
      <ellipse cx={32} cy={38.5} rx={3} ry={2.2} fill={INK}/>
      <g fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round">
        {mood === 'happy' && <path d="M27 42 q2.5 3 5 0 q2.5 3 5 0"/>}
        {mood === 'neutral' && <path d="M28.5 43.5 h7"/>}
        {mood === 'sad' && <path d="M28 45.5 q4 -3.5 8 0"/>}
      </g>
      {mood === 'happy' && <path d="M30.5 44 q1.5 4 3 0 z" fill="var(--ring-main-error-color)"/>}
    </>
  );
};

const Cat = ({mood}: {mood: Mood}) => {
  const tint = TINT[mood];
  return (
    <>
      <path d="M16 26 L19 8 L31 19 Z" fill={`rgba(${tint}, 0.45)`} stroke={INK} strokeWidth={2} strokeLinejoin="round"/>
      <path d="M48 26 L45 8 L33 19 Z" fill={`rgba(${tint}, 0.45)`} stroke={INK} strokeWidth={2} strokeLinejoin="round"/>
      <circle cx={32} cy={36} r={18} fill={PAPER} stroke={INK} strokeWidth={2}/>
      <circle cx={32} cy={36} r={18} fill={`rgba(${tint}, 0.18)`}/>
      <Eyes y={33} mood={mood}/>
      <path d="M30 39 h4 l-2 2.5 z" fill={INK}/>
      <g fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round">
        {mood === 'happy' && <path d="M28 42.5 q2 3 4 0 q2 3 4 0"/>}
        {mood === 'neutral' && <path d="M29 44 h6"/>}
        {mood === 'sad' && <path d="M28.5 46 q3.5 -3 7 0"/>}
      </g>
      <g stroke={INK} strokeWidth={1.2} strokeLinecap="round" opacity={0.7}>
        <path d="M11 38 L23 40"/>
        <path d="M11 44 L23 42"/>
        <path d="M53 38 L41 40"/>
        <path d="M53 44 L41 42"/>
      </g>
    </>
  );
};

const PetFaceComponent = ({species, mood, size = 56}: {species: Species, mood: Mood, size?: number}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${mood} ${species}`}>
    {species === 'cat' ? <Cat mood={mood}/> : <Dog mood={mood}/>}
  </svg>
);

export const PetFace = memo(PetFaceComponent);
