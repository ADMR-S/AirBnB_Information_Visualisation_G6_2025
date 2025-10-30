all : us.json

clean:
	rm -rf -- us.json build

build/cb_2020_us_county_20m.zip:
	mkdir -p $(dir $@)
	curl --fail -o build/cb_2020_us_county_20m.zip https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_county_20m.zip
build/cb_2020_us_county_20m.shp: build/cb_2020_us_county_20m.zip
	unzip -od $(dir $@) $<
	touch $@

#PREVIOUS : 
#build/counties.json: build/cb_2020_us_county_20m.shp
#	node preprocess.js

build/counties.json: build/cb_2020_us_county_20m.shp ACS_12_5YR_B01003_with_ann.csv
	node_modules/.bin/topojson \
		-o $@ \
		--id-property='STATEFP+COUNTYFP,Id2' \
		--external-properties=ACS_12_5YR_B01003_with_ann.csv \
		--properties='name=Geography' \
		--properties='population=+d.properties["Estimate; Total"]' \
		--projection='width = 960, height = 600, d3.geo.albersUsa().scale(1280).translate([width / 2, height / 2])' \
		--simplify=.5 \
		-- counties=$<

build/states.json: build/counties.json
	node_modules/.bin/topojson-merge \
		-o $@ \
		--in-object=counties \
		--out-object=states \
		--key='d.id.substring(0, 2)' \
		-- $<

us.json: build/states.json
	node_modules/.bin/topojson-merge \
		-o $@ \
		--in-object=states \
		--out-object=nation \
		-- $<