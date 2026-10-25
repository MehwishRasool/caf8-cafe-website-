import { cafe } from "../data/cafe";

const query = encodeURIComponent(`${cafe.name} ${cafe.address}`);

// Map, address and opening hours. Used on the About and Contact pages.
export default function FindUs() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="min-h-72 overflow-hidden rounded-2xl bg-mint shadow-sm">
        <iframe
          title={`Map showing ${cafe.name}`}
          src={`https://www.google.com/maps?q=${query}&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full min-h-72 w-full border-0"
        />
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="font-display text-xl font-bold text-brand">Address</h3>
          <p className="mt-1 text-ink">{cafe.address}</p>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${query}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block font-bold text-brand underline transition duration-200 hover:text-sage"
          >
            Get directions
          </a>
        </div>

        <div>
          <h3 className="font-display text-xl font-bold text-brand">
            Opening hours
          </h3>
          <ul className="mt-1 max-w-xs space-y-1 text-ink">
            {cafe.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4">
                <span>{h.days}</span>
                <span>{h.time}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-xl font-bold text-brand">Contact</h3>
          <p className="mt-1">
            <a
              href={`tel:${cafe.phone}`}
              className="text-ink underline transition duration-200 hover:text-sage"
            >
              {cafe.phone}
            </a>
          </p>
          <p>
            <a
              href={`mailto:${cafe.email}`}
              className="text-ink underline transition duration-200 hover:text-sage"
            >
              {cafe.email}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}