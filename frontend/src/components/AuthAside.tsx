interface AuthAsideProps {
  title: string;
  description: string;
}

export function AuthAside({ title, description }: AuthAsideProps) {
  return (
    <aside className="hidden shrink-0 flex-col justify-center gap-4 bg-primary-dark px-12 py-16 text-white lg:flex flex-1">
      <div className="max-w-88 mx-auto">
        <h2 className="text-3xl font-semibold">{title}</h2>
        <p className="text-white/80">{description}</p>
      </div>
    </aside>
  );
}
