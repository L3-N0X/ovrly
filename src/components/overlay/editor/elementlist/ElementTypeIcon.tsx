import { ElementTypeEnum, type ContainerStyle, type PrismaElement } from "@/lib/types";
import {
  Braces,
  ChartNoAxesColumn,
  Columns3,
  Frame,
  Grid3x3,
  Hash,
  Hourglass,
  Image,
  Rows3,
  Timer,
  Type,
} from "lucide-react";

export const ElementTypeIcon = ({
  element,
  className,
}: {
  element: PrismaElement;
  className?: string;
}) => {
  switch (element.type) {
    case ElementTypeEnum.TITLE:
      return <Type className={className} />;
    case ElementTypeEnum.COUNTER:
      return <Hash className={className} />;
    case ElementTypeEnum.TIMER:
      return <Timer className={className} />;
    case ElementTypeEnum.COUNTDOWN:
      return <Hourglass className={className} />;
    case ElementTypeEnum.TWITCH_STAT:
      return <ChartNoAxesColumn className={className} />;
    case ElementTypeEnum.VARIABLE:
      return <Braces className={className} />;
    case ElementTypeEnum.IMAGE:
      return <Image className={className} />;
    case ElementTypeEnum.BINGO:
      return <Grid3x3 className={className} />;
    case ElementTypeEnum.GROUP:
      return <Frame className={className} />;
    case ElementTypeEnum.CONTAINER: {
      // Mirrors the container's layout direction
      const direction = (element.style as ContainerStyle | null)?.flexDirection ?? "column";
      return direction.startsWith("row") ? (
        <Columns3 className={className} />
      ) : (
        <Rows3 className={className} />
      );
    }
  }
};
