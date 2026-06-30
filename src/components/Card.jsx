import './Card.css';

export function Card({ children, className = '', noPadding = false }) {
  return (
    <div className={`card ${noPadding ? 'card-no-padding' : ''} ${className}`}>
      {children}
    </div>
  );
}
