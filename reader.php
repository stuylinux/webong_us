<?php
 
$file = file_get_contents('amogus.csv');
$lines = explode("\r\n", $file);

//echo $lines[count($lines) - 1];

foreach ($lines as &$line) {
	$line = explode(',', $line);
	foreach ($line as &$item) {
		$item = ($item != '') ? intval($item) : 0;
	}
	$line = implode(',',$line);
}

echo "[[";
echo implode("],\n[",$lines);
echo "]]";