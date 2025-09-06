import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Navbar() {
    return (
        <header className="flex items-center justify-between border border-white/10 bg-white/5 px-10 py-4 backdrop-blur-md">
            <Link href="#" className="text-lg tracking-widest font-semibold text-white/80">
                DANTIPS.
            </Link>

            <nav className="hidden md:flex items-center gap-12 text-md font-semibold text-white/80">
                <Link href="#" className="hover:text-white transition-colors">
                    Home
                </Link>
                <Link href="#" className="hover:text-white transition-colors">
                    About us
                </Link>
                <Link href="#" className="hover:text-white transition-colors">
                    Services
                </Link>
                <Link href="#" className="hover:text-white transition-colors">
                    Blog
                </Link>
            </nav>

            <div className="flex items-center gap-2">
                
            <Button asChild className="bg-white text-black hover:bg-white/90">
                <Link href="#">Contact us</Link>
            </Button>
            </div>
        </header>
    );
}