import type { ImageRef } from "@/lib/types";
import ImageWithCredit from "./ImageWithCredit";

export default function Gallery({ images }: { images: ImageRef[] }) {
  if (!images?.length) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((img) => (
        <figure key={img.src}>
          <ImageWithCredit image={img} className="h-52 w-full object-cover" />
        </figure>
      ))}
    </div>
  );
}
