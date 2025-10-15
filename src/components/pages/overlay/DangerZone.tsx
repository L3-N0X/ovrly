import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DangerZoneProps {
  handleDeleteOverlay: () => void;
}

const DangerZone: React.FC<DangerZoneProps> = ({ handleDeleteOverlay }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger Zone</CardTitle>
        <CardDescription>This action is irreversible. Please be certain.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleDeleteOverlay} variant="destructive" className="w-full">
          Delete Overlay
        </Button>
      </CardContent>
    </Card>
  );
};

export default DangerZone;
