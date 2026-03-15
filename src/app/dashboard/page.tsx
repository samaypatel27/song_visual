import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/");
    }

    return (
        <main
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100vh",
                fontFamily: "sans-serif",
                gap: "1rem",
            }}
        >
            <h1>Dashboard</h1>
            <p>
                Logged in as <strong>{session.user?.email}</strong>
            </p>
        </main>
    );
}
