Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot '../functions/load-book/assets'
[IO.Directory]::CreateDirectory($assetRoot) | Out-Null
foreach ($theme in @(
    @{File='telegram-dg-start.png';Title='DG START';Route='EB  >  DG';Detail='GENERATOR SUPPLY ACTIVE';Accent='#ff5964';Deep='#46121f'},
    @{File='telegram-meter-offline.png';Title='METER OFFLINE';Route='CONNECTION LOST';Detail='CHECK METER AND COLLECTOR';Accent='#ff5964';Deep='#46121f'},
    @{File='telegram-meter-retry.png';Title='METER RETRY';Route='RECONNECTING / WAITING';Detail='WAITING FOR A VALID LIVE READING';Accent='#ffbf47';Deep='#493210'},
    @{File='telegram-meter-live.png';Title='METER LIVE';Route='CONNECTION HEALTHY';Detail='FRESH READING RECEIVED';Accent='#39e69a';Deep='#103d33'},
    @{File='telegram-eb-restored.png';Title='EB RESTORED';Route='DG  >  EB';Detail='MAINS SUPPLY RESTORED';Accent='#39e69a';Deep='#103d33'}
)) {
    $bitmap = New-Object Drawing.Bitmap 1280,380
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = 'AntiAlias'
    $graphics.TextRenderingHint = 'AntiAliasGridFit'
    $rect = New-Object Drawing.Rectangle 0,0,1280,380
    $brush = New-Object Drawing.Drawing2D.LinearGradientBrush $rect,([Drawing.ColorTranslator]::FromHtml($theme.Deep)),([Drawing.ColorTranslator]::FromHtml('#0b1220')),0
    $graphics.FillRectangle($brush,$rect)
    $brush.Dispose()
    $accent=[Drawing.ColorTranslator]::FromHtml($theme.Accent)
    for ($radius=210; $radius -ge 70; $radius-=5) {
        $glow = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(5,$accent.R,$accent.G,$accent.B))
        $graphics.FillEllipse($glow,(1060-$radius),(190-$radius),($radius*2),($radius*2))
        $glow.Dispose()
    }
    $pen = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(100,$accent.R,$accent.G,$accent.B)),2
    $graphics.DrawRectangle($pen,18,18,1243,343)
    $pen.Dispose()
    $white=New-Object Drawing.SolidBrush ([Drawing.Color]::White)
    $muted=New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml('#d4dde8'))
    $colored=New-Object Drawing.SolidBrush $accent
    $eyebrow=New-Object Drawing.Font 'Arial',17,([Drawing.FontStyle]::Bold)
    $titleSize=if ($theme.Title.Length -gt 12) {48} else {64}
    $title=New-Object Drawing.Font 'Arial',$titleSize,([Drawing.FontStyle]::Bold)
    $detail=New-Object Drawing.Font 'Arial',18,([Drawing.FontStyle]::Bold)
    $route=New-Object Drawing.Font 'Arial',24,([Drawing.FontStyle]::Bold)
    $graphics.DrawString('WB AIRTEL MSC  /  POWER ALERT',$eyebrow,$muted,66,49)
    $graphics.FillRectangle($colored,66,93,62,4)
    $graphics.DrawString($theme.Title,$title,$white,58,112)
    $graphics.DrawString($theme.Route,$route,$colored,66,245)
    $graphics.DrawString($theme.Detail,$detail,$muted,66,304)
    $circleBrush=New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(155,8,18,29))
    $graphics.FillEllipse($circleBrush,978,108,164,164)
    $circlePen=New-Object Drawing.Pen $accent,3
    $graphics.DrawEllipse($circlePen,978,108,164,164)
    [Drawing.PointF[]]$bolt=@([Drawing.PointF]::new(1067,131),[Drawing.PointF]::new(1015,196),[Drawing.PointF]::new(1052,196),[Drawing.PointF]::new(1040,246),[Drawing.PointF]::new(1100,177),[Drawing.PointF]::new(1063,177))
    $graphics.FillPolygon($colored,$bolt)
    $bitmap.Save((Join-Path $assetRoot $theme.File),[Drawing.Imaging.ImageFormat]::Png)
    foreach($resource in @($eyebrow,$title,$detail,$route,$white,$muted,$colored,$circleBrush,$circlePen,$graphics,$bitmap)){$resource.Dispose()}
}
