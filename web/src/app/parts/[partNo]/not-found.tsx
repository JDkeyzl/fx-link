import Link from "next/link";

export default function PartNotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-[#002d54]">Part not found</h1>
      <p className="mt-3 text-sm text-zinc-600">
        This part number is not in our database, or the parts API is not
        reachable.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-xl bg-[#002d54] px-6 py-3 text-sm font-medium text-white hover:bg-[#003d6e]"
      >
        Back to home
      </Link>
    </div>
  );
}
