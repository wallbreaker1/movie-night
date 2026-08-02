import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getMovies } from "@/lib/movies";
import RoomClient from "@/components/RoomClient";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    redirect("/login");
  }

  const movies = getMovies();

  return (
    <main className="flex-1 bg-neutral-950">
      <RoomClient name={session.name} movies={movies} />
    </main>
  );
}
