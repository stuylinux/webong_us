<?php
 
$file = file_get_contents('amogus.csv');
$lines = explode("\r\n", $file);

$output = "";
//echo $lines[count($lines) - 1];

foreach ($lines as &$line) {
	$line = explode(',', $line);
	foreach ($line as &$item) {
		$item = ($item != '') ? intval($item) : 0;
	}
	$line = implode(',',$line);
}

$output = "[[";
$output .= implode("],\n[",$lines);
$output .= "]]";

file_put_contents("map.json", $output);

$array = json_decode($output, true);

$put2 = "[";
for ($vent = -10; $vent >= -19; $vent--) {
	$put2 .= "[";
	$alr = false;
	for ($j = 0; $j < count($array); $j++) {
		for ($i = 0; $i < count($array[0]); $i++) {
			if ($array[$j][$i] == $vent) {
				if ($alr) { $put2 .= ",";}
				$put2 .= "[" . $i . ',' . $j . "]";
				$alr = true;
			}
		}
	}
	$put2 .= "]" . ($vent == -19 ? '' : ',') . "\n";
}
$put2 .= "]";
file_put_contents("map_vents.json", $put2);