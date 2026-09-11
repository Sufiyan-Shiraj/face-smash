export default function StepRail({ steps, current }) {
  return (
    <div className="step-rail">
      <div className="steps">
        {steps.map((label, i) => (
          <div key={label} className="step-group">
            <div className={`step${i < current ? ' done' : i === current ? ' current' : ''}`}>
              <span className="step-dot">{i < current ? '✓' : i + 1}</span>
              <span className="step-label">{label}</span>
            </div>
            {i < steps.length - 1 && <span className="step-bar" />}
          </div>
        ))}
      </div>
    </div>
  )
}
