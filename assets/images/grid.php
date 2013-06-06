<?php
  $size = isset($_GET['size']) && is_numeric($_GET['size']) ? $_GET['size'] : 80;
  $color = isset($_GET['color']) ? $_GET['color'] : 'gray';
  header("Content-type: image/svg+xml");
?>
<svg width="3000" height="3000" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="<?php echo $size; ?>" height="<?php echo $size ?>" patternUnits="userSpaceOnUse">
      <path d="M <?php echo $size; ?> 0 L 0 0 0 <?php echo $size; ?>" class="grid-path" fill="none" stroke="<?php echo $color; ?>" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#grid)" />
</svg>