type PlaceholderProps = {
  title: string
  description?: string
}

const Placeholder = ({ title, description }: PlaceholderProps) => {
  return (
    <section className="placeholder">
      <div className="placeholder__card">
        <h1 className="placeholder__title">{title}</h1>
        <p className="placeholder__description">
          {description ?? 'Estamos preparando esta area para a proxima etapa do MVP.'}
        </p>
      </div>
    </section>
  )
}

export default Placeholder
