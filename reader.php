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

$checks = ['tasks', -10,-11,-12,-13,-14,-15,-16,-17,-18,-19];

$put2 = "{";
foreach ($checks as $vent) {
	$put2 .= "\"$vent\" : [";
	$alr = false;
	for ($j = 0; $j < count($array); $j++) {
		for ($i = 0; $i < count($array[0]); $i++) {
			if ($vent <= -10 ? ($array[$j][$i] == $vent) : ($array[$j][$i] >= 3 && $array[$j][$i] <= 15)) {
				if ($alr) { $put2 .= ",";}
				$put2 .= "[" . $i . ',' . $j . "]";
				$alr = true;
			}
		}
	}
	$put2 .= "]" . ($vent == -19 ? '' : ',') . "\n";
}
$put2 .= "}";
file_put_contents("map_extras.json", $put2);
