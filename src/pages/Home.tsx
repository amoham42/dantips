import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronRight, MoveDown } from "lucide-react";
import Link from "next/link";
import CanvasScene from "@/canvas_scene/scene";
import Navbar from "@/components/navbar";

export default function Home() {
  return (
    <div className="overflow-hidden w-screen h-screen">
        <Navbar />
        <div className="absolute inset-0 -z-10 w-100vw h-100vh"><CanvasScene /></div>
        <div className="flex flex-col justify-between h-screen">
            <section className="max-w-xl p-10 text-white">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight">
                Revolutionizing
                <br />
                <span className="block font-light italic opacity-90">healthcare with AI </span>
            </h1>
            <p className="mt-6 max-w-xl text-white/70">
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
                doloremque laudantium, totam rem aperiam, eaque ipsa quae.
            </p>
            <div className="mt-8 justify-end">
  
                <Button className="bg-white text-black hover:bg-white/90" asChild>
                    <Link href="/app">Open the App</Link>
                </Button>
            </div>
        </section>

        <div className="relative flex items-end justify-center mb-40 mx-10">
            
            <div className="z-10">
                <div className="border border-white/20 bg-white/10 text-sm text-white/80 backdrop-blur-md flex flex-col items-center justify-center aspect-square w-18 rounded-full">
                    <h4>Scroll</h4>
                    <MoveDown className="size-5 text-white/80" />
                </div>
            </div>

            <div className="z-20 max-w-sm absolute right-0">
                <ul className="divide-y divide-white/10 rounded-md bg-white/5 backdrop-blur-md border border-white/10">
                    {[
                        "Personalized health Solution",
                        "Scientific Innovation",
                        "Precision and Accuracy",
                    ].map((label) => (
                        <li key={label} className="flex items-center justify-between px-5 py-3">
                            <span className="text-white/90">{label}</span>
                            <ChevronRight className="size-5 text-white/60 ml-20" />
                        </li>
                    ))}
                </ul>
            </div>
        </div>
        </div>

        <section className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl bg-black/80 border-t border-white/10 backdrop-blur-md items-center justify-center ">
            <div className="flex py-2 items-center justify-between mx-20">
                <h2 className="text-2xl sm:text-2xl text-white">
                    Full service <span className="font-light italic">assistant</span>
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    <Avatar className="size-10 ring-2 ring-white/20">
                      <AvatarImage src="https://i.pravatar.cc/96?img=12" alt="User one" />
                      <AvatarFallback>U1</AvatarFallback>
                    </Avatar>
                    <Avatar className="size-10 ring-2 ring-white/20">
                      <AvatarImage src="https://i.pravatar.cc/96?img=32" alt="User two" />
                      <AvatarFallback>U2</AvatarFallback>
                    </Avatar>
                    <Avatar className="size-10 ring-2 ring-white/20">
                      <AvatarImage src="https://i.pravatar.cc/96?img=45" alt="User three" />
                      <AvatarFallback>U3</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="leading-tight">
                    <div className="text-white text-xl font-semibold">100k+</div>
                    <div className="text-white/70 text-sm">Active users</div>
                  </div>
                </div>
            </div>
        </section>
    </div>
  );
}
